import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clientAssetStoragePrefix,
  createLocalAssetStore,
  isSafeStorageKey,
  parseUploadUrl,
  removeLocalAssetPrefix,
  signUploadToken,
  verifyUploadToken,
} from "./localAssetStore";

const SECRET = "local-development-secret";

const roots: string[] = [];

async function makeStore(now = () => new Date("2026-01-01T00:00:00Z")) {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "launchpad-assets-"));
  roots.push(rootDirectory);
  return createLocalAssetStore({ rootDirectory, signingSecret: SECRET, now });
}

afterEach(() => {
  roots.length = 0;
});

describe("isSafeStorageKey", () => {
  it("accepts the keys the upload service generates", () => {
    expect(isSafeStorageKey("tmp/7/6f1c2f7e-0d3a-4a1e-9b6a-1a2b3c4d5e6f")).toBe(true);
    expect(isSafeStorageKey("clients/7-acme/astro/navLogo-abc123-def456.webp")).toBe(true);
  });

  it("rejects traversal, absolute, and empty segments", () => {
    expect(isSafeStorageKey("../secrets")).toBe(false);
    expect(isSafeStorageKey("tmp/../../etc/passwd")).toBe(false);
    expect(isSafeStorageKey("/tmp/7/file")).toBe(false);
    expect(isSafeStorageKey("tmp//file")).toBe(false);
    expect(isSafeStorageKey("")).toBe(false);
  });

  it("rejects backslashes so Windows paths cannot escape the root", () => {
    expect(isSafeStorageKey("tmp\\..\\escape")).toBe(false);
  });
});

describe("upload tokens", () => {
  const expiresAt = Date.parse("2026-01-01T00:05:00Z");

  it("accepts a token it just signed", () => {
    const token = signUploadToken(SECRET, "tmp/7/abc", expiresAt);
    expect(verifyUploadToken(SECRET, "tmp/7/abc", expiresAt, token, new Date("2026-01-01T00:01:00Z"))).toBe(true);
  });

  it("rejects a token signed for a different key", () => {
    const token = signUploadToken(SECRET, "tmp/7/abc", expiresAt);
    expect(verifyUploadToken(SECRET, "tmp/7/other", expiresAt, token, new Date("2026-01-01T00:01:00Z"))).toBe(false);
  });

  it("rejects a token after it expires", () => {
    const token = signUploadToken(SECRET, "tmp/7/abc", expiresAt);
    expect(verifyUploadToken(SECRET, "tmp/7/abc", expiresAt, token, new Date("2026-01-01T00:06:00Z"))).toBe(false);
  });

  it("rejects a forged token", () => {
    expect(verifyUploadToken(SECRET, "tmp/7/abc", expiresAt, "deadbeef", new Date("2026-01-01T00:01:00Z"))).toBe(false);
  });
});

describe("createLocalAssetStore", () => {
  it("round-trips an object through the filesystem", async () => {
    const { store } = await makeStore();
    await store.putObject({
      key: "clients/7-acme/astro/navLogo.webp",
      body: Buffer.from("image-bytes"),
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    expect(await store.headObject("clients/7-acme/astro/navLogo.webp")).toEqual({
      contentLength: Buffer.byteLength("image-bytes"),
    });
    const buffer = await store.getObjectBuffer(
      "clients/7-acme/astro/navLogo.webp",
      Buffer.byteLength("image-bytes"),
    );
    expect(buffer.toString()).toBe("image-bytes");
  });

  it("reports a missing object as null rather than throwing", async () => {
    const { store } = await makeStore();
    expect(await store.headObject("tmp/7/missing")).toBeNull();
  });

  it("deletes an object and tolerates deleting it twice", async () => {
    const { store } = await makeStore();
    await store.putObject({
      key: "tmp/7/temp",
      body: Buffer.from("x"),
      contentType: "image/png",
      cacheControl: "no-store",
    });
    await store.deleteObject("tmp/7/temp");
    expect(await store.headObject("tmp/7/temp")).toBeNull();
    await expect(store.deleteObject("tmp/7/temp")).resolves.toBeUndefined();
  });

  it("refuses to write outside its root", async () => {
    const { store } = await makeStore();
    await expect(
      store.putObject({
        key: "../escaped",
        body: Buffer.from("x"),
        contentType: "image/png",
        cacheControl: "no-store",
      }),
    ).rejects.toThrow(/storage key/i);
  });

  it("truncates a ranged read to the expected length", async () => {
    const { store } = await makeStore();
    await store.putObject({
      key: "tmp/7/ranged",
      body: Buffer.from("abcdefgh"),
      contentType: "image/png",
      cacheControl: "no-store",
    });
    expect((await store.getObjectBuffer("tmp/7/ranged", 3)).toString()).toBe("abc");
  });

  it("signs an upload url that verifies against the same key", async () => {
    const { store } = await makeStore();
    const url = await store.createPresignedPut({
      key: "tmp/7/upload",
      contentType: "image/png",
      expiresInSeconds: 600,
    });
    const parsed = parseUploadUrl(url);
    expect(parsed.key).toBe("tmp/7/upload");
    expect(
      verifyUploadToken(SECRET, parsed.key, parsed.expiresAt, parsed.token, new Date("2026-01-01T00:01:00Z")),
    ).toBe(true);
  });

  it("serves assets from a relative prefix so the url survives a port change", async () => {
    const { publicAssetBaseUrl } = await makeStore();
    expect(publicAssetBaseUrl).toBe("/local-assets");
  });
});

describe("readObjectForServing", () => {
  it("reads a stored object back for the dev asset route", async () => {
    const { store, readObjectForServing } = await makeStore();
    await store.putObject({
      key: "clients/7-acme/assets/hero.webp",
      body: Buffer.from("hero"),
      contentType: "image/webp",
      cacheControl: "public",
    });
    const served = await readObjectForServing("clients/7-acme/assets/hero.webp");
    expect(served?.body.toString()).toBe("hero");
    expect(served?.contentType).toBe("image/webp");
  });

  it("returns null for an unknown or unsafe key", async () => {
    const { readObjectForServing } = await makeStore();
    expect(await readObjectForServing("clients/nope.webp")).toBeNull();
    expect(await readObjectForServing("../escape")).toBeNull();
  });
});

describe("writeUploadedObject", () => {
  it("stores the body when the token is valid", async () => {
    const { store, writeUploadedObject, rootDirectory } = await makeStore();
    const url = await store.createPresignedPut({
      key: "tmp/7/incoming",
      contentType: "image/png",
      expiresInSeconds: 600,
    });
    const parsed = parseUploadUrl(url);

    await expect(
      writeUploadedObject(parsed.key, parsed.expiresAt, parsed.token, Buffer.from("payload")),
    ).resolves.toBe(true);
    expect((await readFile(path.join(rootDirectory, "tmp", "7", "incoming"))).toString()).toBe("payload");
  });

  it("refuses a body whose token does not match", async () => {
    const { writeUploadedObject } = await makeStore();
    const expiresAt = Date.parse("2026-01-01T00:05:00Z");
    await expect(
      writeUploadedObject("tmp/7/incoming", expiresAt, "bad", Buffer.from("payload")),
    ).resolves.toBe(false);
  });
});

describe("client local asset prefix", () => {
  it("matches the upload folder for a named client", () => {
    expect(clientAssetStoragePrefix({ id: 7, shortName: "Theme Matrix QA" })).toBe(
      "clients/7-theme-matrix-qa",
    );
  });

  it("removes the client directory without leaving the root", async () => {
    const { rootDirectory, store } = await makeStore();
    await store.putObject({
      key: "clients/7-theme-matrix-qa/astro/nav.webp",
      body: Buffer.from("nav"),
      contentType: "image/webp",
      cacheControl: "public",
    });
    await removeLocalAssetPrefix(rootDirectory, "clients/7-theme-matrix-qa");
    expect(await store.headObject("clients/7-theme-matrix-qa/astro/nav.webp")).toBeNull();
  });
});

describe("existing files on disk", () => {
  it("is visible to headObject when written outside the store", async () => {
    const { store, rootDirectory } = await makeStore();
    await mkdir(path.join(rootDirectory, "tmp", "9"), { recursive: true });
    await writeFile(path.join(rootDirectory, "tmp", "9", "seeded"), "seeded-bytes");
    expect(await store.headObject("tmp/9/seeded")).toEqual({
      contentLength: Buffer.byteLength("seeded-bytes"),
    });
  });
});
