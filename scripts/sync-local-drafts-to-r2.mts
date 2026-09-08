import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createR2ObjectStore } from "../server/r2";
import { contentTypeForStorageKey } from "../server/localAssetStore";
import { tryUsableR2Configuration } from "../server/_core/env";

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

const config = tryUsableR2Configuration();
if (!config) {
  throw new Error("Set real R2 credentials. Placeholder example.com values cannot receive drafts.");
}

const store = createR2ObjectStore(config);
const keys = await listFiles(ROOT);
let uploaded = 0;
for (const key of keys) {
  const body = await readFile(path.join(ROOT, ...key.split("/")));
  await store.putObject({
    key,
    body,
    contentType: contentTypeForStorageKey(key),
    cacheControl: "public, max-age=31536000, immutable",
  });
  uploaded += 1;
}
console.log(`Uploaded ${uploaded} draft files to Launchpad R2.`);
