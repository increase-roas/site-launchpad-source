import { generateAstroClientConfig, type AstroClientConfigInput } from "../shared/astroConfig";
import {
  applyPublishedAssetUrls,
  applyPublishedCategoryHeroUrls,
  applyPublishedHomepageUrls,
  applyPublishedLibraryUrls,
  clientIdFromDraftStorageKey,
  collectUsedDraftMedia,
  describeMissingDraftImage,
  planMediaSync,
  publicObjectUrl,
  type MediaPublication,
  type UsedDraftMedia,
} from "../shared/publishedMedia";
import {
  deriveRuntimeMode,
  readAssetStorageDriver,
  tryUsableR2Configuration,
  type AssetStorageDriver,
} from "./_core/env";
import { getAstroConfigView } from "./astroConfigDb";
import { getDevelopmentAssetStore } from "./developmentAssetStore";
import { contentTypeForStorageKey } from "./localAssetStore";
import { findPublishedAssetBaseUrls } from "./publishedAssetOrigins";
import { createCloudflareApiClient } from "./publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "./publisher/publisherEnv";
import { createR2ObjectStore, readR2ObjectForServing } from "./r2";
import {
  findLatestMediaPublicationByDraftKey,
  listMediaPublications,
  removeMediaPublication,
  saveMediaPublication,
} from "./publishedMediaDb";

const RECOVERED_DRAFT_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type PublishedMediaSyncDependencies = {
  destinationBucket: string;
  publicBaseUrl: string;
  used: readonly UsedDraftMedia[];
  publications: readonly MediaPublication[];
  readDraft(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  deleteObject(key: string): Promise<void>;
  savePublication(publication: MediaPublication): Promise<MediaPublication>;
  removePublication(publication: MediaPublication): Promise<void>;
};

type DraftAsset = { body: Buffer; contentType: string };

export async function readDraftAssetObject(
  key: string,
  deps: {
    driver?: AssetStorageDriver;
    readLocal?: (key: string) => Promise<DraftAsset | null>;
    readRemote?: (key: string) => Promise<DraftAsset | null>;
  } = {},
): Promise<DraftAsset | null> {
  const driver = deps.driver ?? readAssetStorageDriver(deriveRuntimeMode());
  const readLocal = deps.readLocal ?? readLocalDraftAsset;
  const readRemote = deps.readRemote ?? readRemoteDraftAsset;
  if (driver === "local") {
    return (await readLocal(key)) ?? readRemote(key);
  }
  return readRemote(key);
}

async function readLocalDraftAsset(key: string): Promise<DraftAsset | null> {
  try {
    return await getDevelopmentAssetStore().readObjectForServing(key);
  } catch {
    return null;
  }
}

async function readRemoteDraftAsset(key: string): Promise<DraftAsset | null> {
  try {
    return await readR2ObjectForServing(key);
  } catch {
    return null;
  }
}

export async function readDraftForPublishedSync(
  key: string,
  deps: {
    readLaunchpad(key: string): Promise<DraftAsset | null>;
    readPublished(key: string): Promise<DraftAsset | null>;
  },
): Promise<DraftAsset | null> {
  return (await deps.readLaunchpad(key)) ?? deps.readPublished(key);
}

export async function readDraftAssetFromPublicUrl(
  key: string,
  deps: {
    publicAssetBaseUrl: string;
    fetchFn?: typeof fetch;
  },
): Promise<DraftAsset | null> {
  return readPublishedAssetUrl(publicObjectUrl(deps.publicAssetBaseUrl, key), key, deps.fetchFn);
}

async function readPublishedAssetUrl(
  url: string,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<DraftAsset | null> {
  const response = await fetchFn(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Draft image download failed (${response.status}).`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || contentTypeForStorageKey(key),
  };
}

async function recoverPublishedDraftAsset(
  key: string,
  deps: {
    findPublication(key: string): Promise<MediaPublication | null>;
    findPublishedBaseUrls(clientId: number): Promise<string[]>;
    readPublishedUrl(url: string, key: string): Promise<DraftAsset | null>;
  },
): Promise<DraftAsset | null> {
  const publication = await deps.findPublication(key);
  if (publication) {
    try {
      const fromPublication = await deps.readPublishedUrl(publication.publishedUrl, key);
      if (fromPublication) return fromPublication;
    } catch {
      // Try the client's other published origins next.
    }
  }
  const clientId = clientIdFromDraftStorageKey(key);
  if (!clientId) return null;
  for (const baseUrl of await deps.findPublishedBaseUrls(clientId)) {
    try {
      const fromOrigin = await deps.readPublishedUrl(publicObjectUrl(baseUrl, key), key);
      if (fromOrigin) return fromOrigin;
    } catch {
      // Keep looking at remaining preview/publish origins.
    }
  }
  return null;
}

async function writeRecoveredDraftAsset(key: string, asset: DraftAsset): Promise<void> {
  const remote = tryUsableR2Configuration();
  if (remote) {
    await createR2ObjectStore(remote).putObject({
      key,
      body: asset.body,
      contentType: asset.contentType,
      cacheControl: RECOVERED_DRAFT_CACHE_CONTROL,
    });
  }
  if (readAssetStorageDriver(deriveRuntimeMode()) === "local") {
    await getDevelopmentAssetStore().store.putObject({
      key,
      body: asset.body,
      contentType: asset.contentType,
      cacheControl: RECOVERED_DRAFT_CACHE_CONTROL,
    });
  }
}

/**
 * Editor GET `/local-assets` uses the same draft store as uploads, then the
 * website-bucket copy already published for preview/production.
 */
export async function readDraftAssetForServing(
  key: string,
  deps: {
    readDraft?: (key: string) => Promise<DraftAsset | null>;
    findPublication?: (key: string) => Promise<MediaPublication | null>;
    findPublishedBaseUrls?: (clientId: number) => Promise<string[]>;
    readPublishedUrl?: (url: string, key: string) => Promise<DraftAsset | null>;
    writeDraft?: (key: string, asset: DraftAsset) => Promise<void>;
  } = {},
): Promise<DraftAsset | null> {
  const readDraft = deps.readDraft ?? readDraftAssetObject;
  const draft = await readDraft(key);
  if (draft || key.startsWith("tmp/")) return draft;

  let recovered: DraftAsset | null = null;
  try {
    recovered = await recoverPublishedDraftAsset(key, {
      findPublication:
        deps.findPublication ??
        (async storageKey => {
          try {
            return await findLatestMediaPublicationByDraftKey(storageKey);
          } catch {
            return null;
          }
        }),
      findPublishedBaseUrls:
        deps.findPublishedBaseUrls ??
        (async clientId => {
          try {
            return await findPublishedAssetBaseUrls(clientId);
          } catch {
            return [];
          }
        }),
      readPublishedUrl:
        deps.readPublishedUrl ??
        ((url, storageKey) => readPublishedAssetUrl(url, storageKey)),
    });
  } catch {
    return null;
  }
  if (!recovered) return null;

  try {
    await (deps.writeDraft ?? writeRecoveredDraftAsset)(key, recovered);
  } catch {
    // Serving still succeeds when the draft store cannot accept a write-through.
  }
  return recovered;
}

export async function executePublishedMediaSync(
  dependencies: PublishedMediaSyncDependencies,
): Promise<{ urlByDraftKey: Record<string, string> }> {
  const plan = planMediaSync({
    used: dependencies.used,
    publications: dependencies.publications,
    destinationBucket: dependencies.destinationBucket,
  });
  const urlByDraftKey: Record<string, string> = {};

  for (const media of plan.keepPublic) {
    urlByDraftKey[media.storageKey] = media.storageUrl;
  }
  for (const { media, publication } of plan.reuse) {
    urlByDraftKey[media.storageKey] = publication.publishedUrl;
  }

  for (const media of plan.upload) {
    const draft = await dependencies.readDraft(media.storageKey);
    if (!draft) {
      throw new Error(describeMissingDraftImage(media.storageKey));
    }
    await dependencies.putObject({
      key: media.storageKey,
      body: draft.body,
      contentType: draft.contentType,
    });
    const publication = await dependencies.savePublication({
      mediaItemId: media.mediaItemId,
      draftStorageKey: media.storageKey,
      publishedKey: media.storageKey,
      publishedUrl: publicObjectUrl(dependencies.publicBaseUrl, media.storageKey),
      destinationBucket: dependencies.destinationBucket,
    });
    urlByDraftKey[media.storageKey] = publication.publishedUrl;
  }

  for (const publication of plan.delete) {
    await dependencies.deleteObject(publication.publishedKey);
    await dependencies.removePublication(publication);
  }

  return { urlByDraftKey };
}

export type SyncClientPublishedMediaInput = {
  clientId: number;
  destinationBucket: string;
  publicBaseUrl: string;
  usedMedia?: UsedDraftMedia[];
  deployInput?: AstroClientConfigInput;
  deployAssets?: Array<{
    slot: string;
    storageKey: string;
    storageUrl: string;
  }>;
  deployLibrary?: Array<{
    id: number;
    storageKey: string;
    storageUrl: string;
    alt: string;
    description: string;
  }>;
  signal?: AbortSignal;
};

export async function syncClientPublishedMedia(
  input: SyncClientPublishedMediaInput,
): Promise<{ generatedConfig: string }> {
  const view = !input.deployInput || !input.deployAssets || !input.deployLibrary || !input.usedMedia
    ? await getAstroConfigView(input.clientId)
    : null;
  const deployInput = input.deployInput ?? view?.input;
  const deployAssets = input.deployAssets ?? view?.assets.map(asset => ({
    slot: asset.slot,
    storageKey: asset.storageKey,
    storageUrl: asset.storageUrl,
  }));
  const deployLibrary = input.deployLibrary ?? view?.mediaItems.map(item => ({
    id: item.id,
    storageKey: item.storageKey,
    storageUrl: item.storageUrl,
    alt: item.alt,
    description: item.description,
  }));
  if (!deployInput || !deployAssets || !deployLibrary) {
    throw new Error("Website configuration is required to publish media.");
  }
  const usedMedia = input.usedMedia ?? usedDraftMediaFromView({
    assets: deployAssets,
    mediaItems: deployLibrary,
    input: deployInput,
  });
  const signal = input.signal ?? new AbortController().signal;
  const cloudflare = createCloudflareApiClient(getCloudflarePublisherEnvironment());
  const publications = await listMediaPublications(input.clientId, input.destinationBucket);
  const { urlByDraftKey } = await executePublishedMediaSync({
    destinationBucket: input.destinationBucket,
    publicBaseUrl: input.publicBaseUrl,
    used: usedMedia,
    publications,
    async readDraft(key) {
      return readDraftForPublishedSync(key, {
        readLaunchpad: readDraftAssetObject,
        async readPublished(storageKey) {
          const fromBucket = await cloudflare.getR2Object({
            bucket: input.destinationBucket,
            key: storageKey,
            signal,
          });
          if (fromBucket) return fromBucket;
          return readDraftAssetFromPublicUrl(storageKey, {
            publicAssetBaseUrl: input.publicBaseUrl,
          });
        },
      });
    },
    async putObject(object) {
      await cloudflare.putR2Object({
        bucket: input.destinationBucket,
        key: object.key,
        body: object.body,
        contentType: object.contentType,
        signal,
      });
    },
    async deleteObject(key) {
      await cloudflare.deleteR2Object({
        bucket: input.destinationBucket,
        key,
        signal,
      });
    },
    savePublication: publication => saveMediaPublication(input.clientId, publication),
    removePublication: publication => removeMediaPublication(input.clientId, publication),
  });

  return {
    generatedConfig: generateAstroClientConfig(
      {
        ...deployInput,
        homepageSections: applyPublishedHomepageUrls(deployInput.homepageSections, urlByDraftKey),
        categories: applyPublishedCategoryHeroUrls(deployInput.categories, urlByDraftKey),
      },
      applyPublishedAssetUrls(deployAssets, urlByDraftKey),
      applyPublishedLibraryUrls(deployLibrary, urlByDraftKey),
    ),
  };
}

export function usedDraftMediaFromView(view: {
  assets: Array<{
    storageKey: string;
    storageUrl: string;
    mediaItemId?: number | null;
  }>;
  mediaItems: Array<{
    id: number;
    storageKey: string;
    storageUrl: string;
    alt: string;
    description: string;
  }>;
  input: AstroClientConfigInput;
}): UsedDraftMedia[] {
  return collectUsedDraftMedia({
    assets: view.assets,
    mediaItems: view.mediaItems,
    homepageSections: view.input.homepageSections,
    categories: view.input.categories,
  });
}

