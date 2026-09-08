import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createR2ObjectStore } from "../server/r2";
import { contentTypeForStorageKey } from "../server/localAssetStore";
import { tryUsableR2Configuration } from "../server/_core/env";
import {
  launchpadDraftBucketName,
  writePublisherDraftObject,
} from "../server/publisherDraftStore";
import { createCloudflareApiClient } from "../server/publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "../server/publisher/publisherEnv";

const ROOT = path.resolve(process.cwd(), process.env.LOCAL_ASSET_DIR?.trim() || ".local-assets");

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const keys: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      keys.push(...await listFiles(path.join(directory, entry.name), relative));
      continue;
    }
    if (entry.isFile() && !relative.startsWith("tmp/")) keys.push(relative);
  }
  return keys;
}

const keys = await listFiles(ROOT);
const config = tryUsableR2Configuration();
if (config) {
  const store = createR2ObjectStore(config);
  for (const key of keys) {
    const body = await readFile(path.join(ROOT, ...key.split("/")));
    await store.putObject({
      key,
      body,
      contentType: contentTypeForStorageKey(key),
      cacheControl: "public, max-age=31536000, immutable",
    });
  }
  console.log(`Uploaded ${keys.length} draft files to Launchpad R2.`);
}

const destinationBucket = process.env.R2_SYNC_BUCKET?.trim() || launchpadDraftBucketName();
const cloudflare = createCloudflareApiClient(getCloudflarePublisherEnvironment());
const signal = new AbortController().signal;
for (const key of keys) {
  const body = await readFile(path.join(ROOT, ...key.split("/")));
  await writePublisherDraftObject(
    {
      key,
      body,
      contentType: contentTypeForStorageKey(key),
    },
    { cloudflare, bucket: destinationBucket, signal },
  );
}
console.log(`Uploaded ${keys.length} draft files to ${destinationBucket}.`);
process.exit(0);
