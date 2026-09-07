import { parseGalleryImages, type MediaLibraryItemRef } from "./mediaLibrary";

export type UsedDraftMedia = {
  mediaItemId: number | null;
  storageKey: string;
  storageUrl: string;
};

export type MediaPublication = {
  mediaItemId: number | null;
  draftStorageKey: string;
  publishedKey: string;
  publishedUrl: string;
  destinationBucket: string;
};

export type MediaSyncPlan = {
  upload: UsedDraftMedia[];
  reuse: Array<{ media: UsedDraftMedia; publication: MediaPublication }>;
  keepPublic: UsedDraftMedia[];
  delete: MediaPublication[];
};

const LOCAL_ASSET_PATH_PREFIX = "/local-assets/";
const DRAFT_ASSET_URL_PATTERN =
  /(?:https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)?\/local-assets\/[A-Za-z0-9._\-\/]+/g;

export function draftStorageKeyFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(LOCAL_ASSET_PATH_PREFIX)) {
    return trimmed.slice(LOCAL_ASSET_PATH_PREFIX.length) || null;
  }
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (
      (host === "127.0.0.1" || host === "localhost") &&
      url.pathname.startsWith(LOCAL_ASSET_PATH_PREFIX)
    ) {
      return url.pathname.slice(LOCAL_ASSET_PATH_PREFIX.length) || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function isDraftLocalAssetUrl(value: string): boolean {
  return value.startsWith("/local-assets") || draftStorageKeyFromUrl(value) !== null;
}

/** Worker-reachable assets only. Launchpad drafts stay on `/local-assets`. */
export function isPublicDeployAssetUrl(value: string | undefined): value is string {
  if (!value || isDraftLocalAssetUrl(value)) return false;
  return value.startsWith("/") || value.startsWith("https://");
}

export function extractDraftAssetUrls(value: string): string[] {
  return value.match(DRAFT_ASSET_URL_PATTERN) ?? [];
}

export function rewriteDraftAssetUrlsInText(
  value: string,
  urlByDraftKey: Readonly<Record<string, string>>,
): string {
  return value.replace(DRAFT_ASSET_URL_PATTERN, match => {
    const key = draftStorageKeyFromUrl(match);
    return (key && urlByDraftKey[key]) || match;
  });
}

export function publicObjectUrl(baseUrl: string, key: string): string {
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/${encodedPath}`;
}

function usedFrom(
  storageKey: string,
  storageUrl: string,
  mediaItemId: number | null,
): UsedDraftMedia | null {
  if (!storageKey || !storageUrl) return null;
  return { mediaItemId, storageKey, storageUrl };
}

export function collectUsedDraftMedia(input: {
  assets: ReadonlyArray<{
    storageKey: string;
    storageUrl: string;
    mediaItemId?: number | null;
  }>;
  mediaItems: ReadonlyArray<{
    id: number;
    storageKey: string;
    storageUrl: string;
  }>;
  homepageSections: ReadonlyArray<{
    enabled: boolean;
    type: string;
    fields: Record<string, string>;
  }>;
  categories?: Readonly<Record<string, { heroImage?: string }>>;
}): UsedDraftMedia[] {
  const libraryById = new Map(input.mediaItems.map(item => [item.id, item]));
  const libraryByUrl = new Map(input.mediaItems.map(item => [item.storageUrl, item]));
  const used = new Map<string, UsedDraftMedia>();

  const add = (item: UsedDraftMedia | null) => {
    if (!item || used.has(item.storageKey)) return;
    used.set(item.storageKey, item);
  };

  for (const asset of input.assets) {
    add(usedFrom(asset.storageKey, asset.storageUrl, asset.mediaItemId ?? null));
  }

  const addDraftUrl = (url: string, mediaItemId: number | null = null) => {
    const key = draftStorageKeyFromUrl(url);
    if (!key) return;
    const fromUrl = libraryByUrl.get(url) ?? libraryByUrl.get(`/local-assets/${key}`);
    if (fromUrl) {
      add(usedFrom(fromUrl.storageKey, fromUrl.storageUrl, fromUrl.id));
      return;
    }
    add(usedFrom(key, `/local-assets/${key}`, mediaItemId));
  };

  for (const section of input.homepageSections) {
    if (!section.enabled) continue;
    if (section.type === "gallery") {
      for (const image of parseGalleryImages(section.fields.images ?? "")) {
        const fromId = image.id === undefined ? undefined : libraryById.get(image.id);
        const fromUrl = libraryByUrl.get(image.src);
        const item = fromId ?? fromUrl;
        if (item) {
          add(usedFrom(item.storageKey, item.storageUrl, item.id));
          continue;
        }
        addDraftUrl(image.src, image.id ?? null);
      }
    }
    for (const value of Object.values(section.fields)) {
      for (const url of extractDraftAssetUrls(value)) {
        addDraftUrl(url);
      }
    }
  }

  for (const category of Object.values(input.categories ?? {})) {
    if (category.heroImage) addDraftUrl(category.heroImage);
  }

  return [...used.values()];
}

export function planMediaSync(input: {
  used: readonly UsedDraftMedia[];
  publications: readonly MediaPublication[];
  destinationBucket: string;
}): MediaSyncPlan {
  const usedKeys = new Set(input.used.map(item => item.storageKey));
  const publicationsForBucket = input.publications.filter(
    publication => publication.destinationBucket === input.destinationBucket,
  );
  const publicationByDraftKey = new Map(
    publicationsForBucket.map(publication => [publication.draftStorageKey, publication]),
  );

  const upload: UsedDraftMedia[] = [];
  const reuse: Array<{ media: UsedDraftMedia; publication: MediaPublication }> = [];
  const keepPublic: UsedDraftMedia[] = [];

  for (const media of input.used) {
    if (!isDraftLocalAssetUrl(media.storageUrl)) {
      keepPublic.push(media);
      continue;
    }
    const publication = publicationByDraftKey.get(media.storageKey);
    if (publication) {
      reuse.push({ media, publication });
      continue;
    }
    upload.push(media);
  }

  return {
    upload,
    reuse,
    keepPublic,
    delete: publicationsForBucket.filter(publication => !usedKeys.has(publication.draftStorageKey)),
  };
}

export function applyPublishedAssetUrls(
  assets: ReadonlyArray<{ slot: string; storageKey: string; storageUrl: string }>,
  urlByDraftKey: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    assets.map(asset => [asset.slot, urlByDraftKey[asset.storageKey] ?? asset.storageUrl]),
  );
}

export function applyPublishedLibraryUrls(
  items: ReadonlyArray<MediaLibraryItemRef & { storageKey: string }>,
  urlByDraftKey: Readonly<Record<string, string>>,
): MediaLibraryItemRef[] {
  return items.map(item => ({
    id: item.id,
    storageUrl: urlByDraftKey[item.storageKey] ?? item.storageUrl,
    alt: item.alt,
    description: item.description,
  }));
}

export function applyPublishedHomepageUrls<
  TSection extends { fields: Record<string, string> },
>(
  sections: readonly TSection[],
  urlByDraftKey: Readonly<Record<string, string>>,
): TSection[] {
  return sections.map(section => ({
    ...section,
    fields: Object.fromEntries(
      Object.entries(section.fields).map(([name, value]) => [
        name,
        rewriteDraftAssetUrlsInText(value, urlByDraftKey),
      ]),
    ),
  }));
}

export function applyPublishedCategoryHeroUrls<
  TCategories extends Record<string, { heroImage: string }>,
>(
  categories: TCategories,
  urlByDraftKey: Readonly<Record<string, string>>,
): TCategories {
  return Object.fromEntries(
    Object.entries(categories).map(([key, category]) => [
      key,
      {
        ...category,
        heroImage: rewriteDraftAssetUrlsInText(category.heroImage, urlByDraftKey),
      },
    ]),
  ) as TCategories;
}
