import { contentTypeForStorageKey } from "./localAssetStore";
import { createCloudflareApiClient, type CloudflareApiClient } from "./publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "./publisher/publisherEnv";
import type { R2ObjectStore } from "./r2";

export const DEFAULT_LAUNCHPAD_DRAFT_BUCKET = "site-launchpad-drafts";

type DraftAsset = { body: Buffer; contentType: string };

export function launchpadDraftBucketName(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return environment.LAUNCHPAD_DRAFT_R2_BUCKET?.trim() || DEFAULT_LAUNCHPAD_DRAFT_BUCKET;
}

export function tryCreatePublisherDraftClient(): CloudflareApiClient | null {
  try {
    return createCloudflareApiClient(getCloudflarePublisherEnvironment());
  } catch {
    return null;
  }
}

export async function readPublisherDraftObject(
  key: string,
  deps: {
    cloudflare?: CloudflareApiClient | null;
    bucket?: string;
    signal?: AbortSignal;
  } = {},
): Promise<DraftAsset | null> {
  if (key.startsWith("tmp/")) return null;
  const cloudflare = deps.cloudflare === undefined
    ? tryCreatePublisherDraftClient()
    : deps.cloudflare;
  if (!cloudflare) return null;
  try {
    const found = await cloudflare.getR2Object({
      bucket: deps.bucket ?? launchpadDraftBucketName(),
      key,
      signal: deps.signal ?? new AbortController().signal,
    });
    if (!found) return null;
    return {
      body: found.body,
      contentType: found.contentType || contentTypeForStorageKey(key),
    };
  } catch {
    return null;
  }
}

const ensuredBuckets = new Set<string>();

export async function writePublisherDraftObject(
  input: { key: string; body: Buffer; contentType: string },
  deps: {
    cloudflare?: CloudflareApiClient | null;
    bucket?: string;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  if (input.key.startsWith("tmp/")) return;
  const cloudflare = deps.cloudflare === undefined
    ? tryCreatePublisherDraftClient()
    : deps.cloudflare;
  if (!cloudflare) return;
  const signal = deps.signal ?? new AbortController().signal;
  const bucket = deps.bucket ?? launchpadDraftBucketName();
  if (!ensuredBuckets.has(bucket)) {
    await cloudflare.ensureR2Bucket(bucket, signal);
    ensuredBuckets.add(bucket);
  }
  await cloudflare.putR2Object({
    bucket,
    key: input.key,
    body: input.body,
    contentType: input.contentType,
    signal,
  });
}

/** Replica used when local disk is the upload primary. Temp keys stay local. */
export function createPublisherDraftObjectStore(
  deps: {
    cloudflare?: CloudflareApiClient | null;
    bucket?: string;
  } = {},
): R2ObjectStore {
  return {
    async createPresignedPut() {
      throw new Error("Publisher draft storage does not issue upload URLs.");
    },
    async headObject() {
      return null;
    },
    async getObjectBuffer() {
      throw new Error("Publisher draft storage is write-through only.");
    },
    async putObject(input) {
      await writePublisherDraftObject(input, deps);
    },
    async deleteObject() {
      return;
    },
  };
}

export function tryCreatePublisherDraftObjectStore(): R2ObjectStore | null {
  const cloudflare = tryCreatePublisherDraftClient();
  return cloudflare ? createPublisherDraftObjectStore({ cloudflare }) : null;
}
