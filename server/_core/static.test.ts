import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import {
  intendedClientAssetDirectory,
  MISSING_CLIENT_BUILD_MESSAGE,
  serveStatic,
} from "./static";

const PRODUCTION_ENV = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
  JWT_SECRET: "legacy-decryption-test-key",
  DATABASE_URL: "postgresql://runtime.invalid/site-launchpad",
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "site-launchpad-assets",
  R2_PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
  SECRETS_ENCRYPTION_KEY: "encryption-test-key",
} as const;

function setProductionEnv(): void {
  vi.stubEnv("NODE_ENV", "production");
  for (const [name, value] of Object.entries(PRODUCTION_ENV)) {
    vi.stubEnv(name, value);
  }
}

const createdDirectories: string[] = [];

function createClientBuild(contents: { indexHtml: string; assetBody?: string }): string {
  const directory = mkdtempSync(path.join(tmpdir(), "site-launchpad-client-"));
  createdDirectories.push(directory);
  writeFileSync(path.join(directory, "index.html"), contents.indexHtml);
  if (contents.assetBody !== undefined) {
    const assetsDirectory = path.join(directory, "assets");
    mkdirSync(assetsDirectory);
    writeFileSync(path.join(assetsDirectory, "app.js"), contents.assetBody);
  }
  return directory;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of createdDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("intended client asset directory", () => {
  it("resolves dist/public from the repository root, never server/_core/public", () => {
    const resolved = intendedClientAssetDirectory("/repo");
    expect(resolved).toBe(path.resolve("/repo", "dist/public"));
    expect(resolved).not.toContain(`${path.sep}_core${path.sep}`);
  });
});

describe("production static delivery", () => {
  it("serves built assets and SPA fallback from the intended client directory", async () => {
    setProductionEnv();
    const clientAssetDirectory = createClientBuild({
      indexHtml: "<!doctype html><title>spa</title>",
      assetBody: "window.__ASSET=true;",
    });
    const app = await createApp({
      mode: "production",
      clientAssetDirectory,
    });

    const asset = await request(app).get("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.text).toBe("window.__ASSET=true;");

    const spa = await request(app).get("/workspace/12/pages");
    expect(spa.status).toBe(200);
    expect(spa.text).toContain("<title>spa</title>");

    const api = await request(app).get("/api/not-a-route");
    expect(api.status).toBe(404);
    expect(api.body).toEqual({ error: "Not Found" });
  });

  it("returns controlled JSON when the client build is missing", async () => {
    setProductionEnv();
    const missingDirectory = mkdtempSync(path.join(tmpdir(), "site-launchpad-missing-"));
    createdDirectories.push(missingDirectory);
    const app = await createApp({
      mode: "production",
      clientAssetDirectory: missingDirectory,
    });

    const response = await request(app).get("/clients/new");
    expect(response.status).toBe(503);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({ error: MISSING_CLIENT_BUILD_MESSAGE });
    expect(response.text).not.toContain("stack");
    expect(response.text).not.toContain(path.join("server", "_core", "public"));
  });

  it("does not mount client files when Vercel CDN should serve them", async () => {
    setProductionEnv();
    const clientAssetDirectory = createClientBuild({
      indexHtml: "<!doctype html><title>must-not-serve</title>",
    });
    const app = await createApp({
      mode: "production",
      serveClientAssets: false,
      clientAssetDirectory,
    });

    const spa = await request(app).get("/clients/new");
    expect(spa.status).toBe(404);
    expect(spa.text).not.toContain("must-not-serve");

    const input = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));
    const health = await request(app).get(`/api/trpc/system.health?input=${input}`);
    expect(health.status).toBe(200);
  });
});

describe("serveStatic", () => {
  it("does not look up server/_core/public", () => {
    expect(intendedClientAssetDirectory()).not.toContain(
      path.join("server", "_core", "public"),
    );
    expect(serveStatic).toBeTypeOf("function");
  });
});
