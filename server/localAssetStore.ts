import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeClientFolder } from "../shared/client";
import type { R2ObjectStore } from "./r2";

/**
 * Filesystem-backed stand-in for R2, used only when the development machine has
 * no object storage credentials. It mirrors the R2 store's contract so the
 * upload service, its validation, and its cleanup paths run unchanged.
 */

export const DEFAULT_LOCAL_ASSET_URL_PREFIX = "/local-assets";

const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const MAX_STORAGE_KEY_LENGTH = 512;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function clientAssetStoragePrefix(client: { id: number; shortName: string }): string {
  const folder = sanitizeClientFolder(client.shortName) || `client-${client.id}`;
  return `clients/${client.id}-${folder}`;
}

export async function removeLocalAssetPrefix(
  rootDirectory: string,
  prefix: string,
): Promise<void> {
  if (!isSafeStorageKey(prefix)) return;
  const root = path.resolve(rootDirectory);
  const target = path.resolve(root, ...prefix.split("/"));
  if (target === root || !target.startsWith(root + path.sep)) return;
  await rm(target, { recursive: true, force: true });
}

export function contentTypeForStorageKey(key: string): string {
  return CONTENT_TYPE_BY_EXTENSION[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > MAX_STORAGE_KEY_LENGTH) return false;
  if (key.includes("\\") || key.includes("\0")) return false;
  if (key.split("/").includes("..")) return false;
  return STORAGE_KEY_PATTERN.test(key);
}

export function signUploadToken(secret: string, key: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`${key}\n${expiresAt}`).digest("hex");
}

export function verifyUploadToken(
  secret: string,
  key: string,
  expiresAt: number,
  token: string,
  now: Date,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return false;
  if (!isSafeStorageKey(key)) return false;
  const expected = Buffer.from(signUploadToken(secret, key, expiresAt), "utf8");
  const actual = Buffer.from(token, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseUploadUrl(url: string): {
  key: string;
  expiresAt: number;
  token: string;
} {
  // The signed URL is relative, so it needs a base before it can be parsed.
  const parsed = new URL(url, "http://localhost");
  const prefix = `${DEFAULT_LOCAL_ASSET_URL_PREFIX}/`;
  if (!parsed.pathname.startsWith(prefix)) {
    throw new Error(`Not a local asset upload url: ${url}`);
  }
  return {
    key: decodeURIComponent(parsed.pathname.slice(prefix.length)),
    expiresAt: Number(parsed.searchParams.get("expires")),
    token: parsed.searchParams.get("token") ?? "",
  };
}

export type LocalAssetStore = {
  rootDirectory: string;
  publicAssetBaseUrl: string;
  store: R2ObjectStore;
  readObjectForServing(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  writeUploadedObject(
    key: string,
    expiresAt: number,
    token: string,
    body: Buffer,
  ): Promise<boolean>;
};

export function createLocalAssetStore({
  rootDirectory,
  signingSecret,
  urlPrefix = DEFAULT_LOCAL_ASSET_URL_PREFIX,
  now = () => new Date(),
}: {
  rootDirectory: string;
  signingSecret: string;
  urlPrefix?: string;
  now?: () => Date;
}): LocalAssetStore {
  const root = path.resolve(rootDirectory);

  function resolveKey(key: string): string {
    if (!isSafeStorageKey(key)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    const resolved = path.resolve(root, ...key.split("/"));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return resolved;
  }

  async function writeObject(key: string, body: Buffer): Promise<void> {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  const store: R2ObjectStore = {
    async createPresignedPut(input) {
      const expiresAt = now().getTime() + input.expiresInSeconds * 1000;
      const token = signUploadToken(signingSecret, input.key, expiresAt);
      const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
      return `${urlPrefix}/${encodedKey}?expires=${expiresAt}&token=${token}`;
    },
    async headObject(key) {
      try {
        const stats = await stat(resolveKey(key));
        return stats.isFile() ? { contentLength: stats.size } : null;
      } catch {
        return null;
      }
    },
    async getObjectBuffer(key, expectedLength) {
      const buffer = await readFile(resolveKey(key));
      return buffer.subarray(0, expectedLength);
    },
    async putObject(input) {
      await writeObject(input.key, input.body);
    },
    async deleteObject(key) {
      await rm(resolveKey(key), { force: true });
    },
  };

  return {
    rootDirectory: root,
    publicAssetBaseUrl: urlPrefix,
    store,
    async readObjectForServing(key) {
      let target: string;
      try {
        target = resolveKey(key);
      } catch {
        return null;
      }
      try {
        const body = await readFile(target);
        const contentType = contentTypeForStorageKey(target);
        return { body, contentType };
      } catch {
        return null;
      }
    },
    async writeUploadedObject(key, expiresAt, token, body) {
      if (!verifyUploadToken(signingSecret, key, expiresAt, token, now())) return false;
      await writeObject(key, body);
      return true;
    },
  };
}
