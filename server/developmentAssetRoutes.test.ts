import express from "express";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createAssetGetRoutes, createDevelopmentAssetRoutes } from "./developmentAssetRoutes";
import { createLocalAssetStore, parseUploadUrl, type LocalAssetStore } from "./localAssetStore";

let local: LocalAssetStore;
let app: express.Express;

beforeEach(async () => {
  local = createLocalAssetStore({
    rootDirectory: await mkdtemp(path.join(tmpdir(), "launchpad-routes-")),
    signingSecret: "route-test-secret",
  });
  app = express();
  app.use(createDevelopmentAssetRoutes(local));
});

async function signedUploadPath(key: string): Promise<string> {
  return local.store.createPresignedPut({
    key,
    contentType: "image/png",
    expiresInSeconds: 600,
  });
}

describe("PUT upload route", () => {
  it("stores a body signed with a valid token", async () => {
    const url = await signedUploadPath("tmp/7/upload-a");

    await request(app)
      .put(url)
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-bytes"))
      .expect(200);

    expect(await local.store.headObject("tmp/7/upload-a")).toEqual({
      contentLength: Buffer.byteLength("png-bytes"),
    });
  });

  it("rejects a body with a forged token", async () => {
    const url = await signedUploadPath("tmp/7/upload-b");
    const tampered = url.replace(/token=[a-f0-9]+/, "token=deadbeef");

    await request(app)
      .put(tampered)
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-bytes"))
      .expect(403);

    expect(await local.store.headObject("tmp/7/upload-b")).toBeNull();
  });

  it("rejects an unsigned upload", async () => {
    await request(app)
      .put("/local-assets/tmp/7/upload-c")
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-bytes"))
      .expect(403);
  });

  it("round-trips the key the presigned url encoded", async () => {
    const url = await signedUploadPath("clients/7-acme/astro/navLogo.webp");
    expect(parseUploadUrl(url).key).toBe("clients/7-acme/astro/navLogo.webp");

    await request(app)
      .put(url)
      .set("Content-Type", "image/webp")
      .send(Buffer.from("webp"))
      .expect(200);

    expect(await local.store.headObject("clients/7-acme/astro/navLogo.webp")).not.toBeNull();
  });
});

describe("GET asset route", () => {
  it("serves a stored asset with its image content type", async () => {
    await local.store.putObject({
      key: "clients/7-acme/astro/navLogo.webp",
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
      cacheControl: "public",
    });

    const response = await request(app)
      .get("/local-assets/clients/7-acme/astro/navLogo.webp")
      .expect(200);

    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.body.toString()).toBe("webp-bytes");
  });

  it("returns 404 for an unknown asset", async () => {
    await request(app).get("/local-assets/clients/7-acme/astro/missing.webp").expect(404);
  });

  it("lets the browser cache a permanent asset, whose key is content-addressed", async () => {
    await local.store.putObject({
      key: "clients/7-acme/astro/navLogo-abc123-def456.webp",
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
      cacheControl: "public",
    });

    const response = await request(app)
      .get("/local-assets/clients/7-acme/astro/navLogo-abc123-def456.webp")
      .expect(200);

    expect(response.headers["cache-control"]).toContain("immutable");
  });

  it("never caches a staging upload, whose key is reused before processing", async () => {
    await local.store.putObject({
      key: "tmp/7/staged",
      body: Buffer.from("raw"),
      contentType: "image/png",
      cacheControl: "no-store",
    });

    const response = await request(app).get("/local-assets/tmp/7/staged").expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("answers a repeat request with 304 so the bytes are sent once", async () => {
    await local.store.putObject({
      key: "clients/7-acme/assets/hero-abc-def.webp",
      body: Buffer.from("hero-bytes"),
      contentType: "image/webp",
      cacheControl: "public",
    });
    const path = "/local-assets/clients/7-acme/assets/hero-abc-def.webp";

    const first = await request(app).get(path).expect(200);
    await request(app).get(path).set("If-None-Match", first.headers.etag).expect(304);
  });

  it("returns 404 rather than escaping the root", async () => {
    await request(app).get("/local-assets/..%2F..%2Fsecrets").expect(404);
  });
});

describe("GET asset route on the Vercel rewrite prefix", () => {
  it("serves the same key from /api/local-assets", async () => {
    const keyed = express();
    keyed.use(
      createAssetGetRoutes(async key => {
        if (key !== "clients/8/astro/nav.webp") return null;
        return { body: Buffer.from("nav-bytes"), contentType: "image/webp" };
      }),
    );

    const response = await request(keyed)
      .get("/api/local-assets/clients/8/astro/nav.webp")
      .expect(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.body.toString()).toBe("nav-bytes");
  });

  it("serves the same key from /api?localAsset= so Vercel can avoid nested function paths", async () => {
    const keyed = express();
    keyed.use(
      createAssetGetRoutes(async key => {
        if (key !== "clients/8/astro/nav.webp") return null;
        return { body: Buffer.from("nav-bytes"), contentType: "image/webp" };
      }),
    );

    const response = await request(keyed)
      .get("/api")
      .query({ localAsset: "clients/8/astro/nav.webp" })
      .expect(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.body.toString()).toBe("nav-bytes");
  });
});
