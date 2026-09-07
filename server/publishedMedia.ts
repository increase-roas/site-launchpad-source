import { generateAstroClientConfig, type AstroClientConfigInput } from "../shared/astroConfig";
import {
  applyPublishedAssetUrls,
  applyPublishedLibraryUrls,
  collectUsedDraftMedia,
  planMediaSync,
  publicObjectUrl,
  type MediaPublication,
  type UsedDraftMedia,
} from "../shared/publishedMedia";
import { deriveRuntimeMode, readAssetStorageDriver, type AssetStorageDriver } from "./_core/env";
import { getAstroConfigView } from "./astroConfigDb";
import { getDevelopmentAssetStore } from "./developmentAssetStore";
import { contentTypeForStorageKey } from "./localAssetStore";
import { createCloudflareApiClient } from "./publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "./publisher/publisherEnv";
import { readR2Configuration } from "./r2";
import {
  listMediaPublications,
  removeMediaPublication,
  saveMediaPublication,
} from "./publishedMediaDb";

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
  if (driver === "local") {
    return (deps.readLocal ?? readLocalDraftAsset)(key);
  }
  return (deps.readRemote ?? readRemoteDraftAsset)(key);
}

async function readLocalDraftAsset(key: string): Promise<DraftAsset | null> {
  try {
    return await getDevelopmentAssetStore().readObjectForServing(key);
  } catch {
    return null;
  }
}

async function readRemoteDraftAsset(key: string): Promise<DraftAsset | null> {
  return readDraftAssetFromPublicUrl(key, {
    publicAssetBaseUrl: readR2Configuration().publicAssetBaseUrl,
  });
}

export async function readDraftAssetFromPublicUrl(
  key: string,
  deps: {
    publicAssetBaseUrl: string;
    fetchFn?: typeof fetch;
  },
): Promise<DraftAsset | null> {
  const url = publicObjectUrl(deps.publicAssetBaseUrl, key);
  const response = await (deps.fetchFn ?? fetch)(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Draft image download failed (${response.status}).`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || contentTypeForStorageKey(key),
  };
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
      throw new Error(`Draft image is missing: ${media.storageKey}`);
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
      return readDraftAssetObject(key);
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
      deployInput,
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
  });
}

