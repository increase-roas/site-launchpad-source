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

export function isDraftLocalAssetUrl(value: string): boolean {
  return value.startsWith("/local-assets");
}

export function isPublicDeployAssetUrl(value: string | undefined): value is string {
  return Boolean(
    value &&
      (value.startsWith("/") || value.startsWith("https://")) &&
      !isDraftLocalAssetUrl(value),
  );
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

  for (const section of input.homepageSections) {
    if (!section.enabled || section.type !== "gallery") continue;
    for (const image of parseGalleryImages(section.fields.images ?? "")) {
      const fromId = image.id === undefined ? undefined : libraryById.get(image.id);
      const fromUrl = libraryByUrl.get(image.src);
      const item = fromId ?? fromUrl;
      if (item) {
        add(usedFrom(item.storageKey, item.storageUrl, item.id));
        continue;
      }
      add(usedFrom(image.src.replace(/^\/local-assets\//, ""), image.src, image.id ?? null));
    }
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
