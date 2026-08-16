import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";

type VercelRewrite = {
  source: string;
  destination: string;
};

type VercelConfig = {
  framework: null;
  outputDirectory: string;
  rewrites: VercelRewrite[];
};

type RoutedRequest =
  | { kind: "function"; file: string; url: string }
  | { kind: "static-cdn"; pathname: string }
  | { kind: "spa"; pathname: "/index.html" };

const API_DIRECTORY = path.resolve(import.meta.dirname, "../../api");
const HEALTH_INPUT = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));
const HEALTH_PATH = `/api/trpc/system.health?input=${HEALTH_INPUT}`;

const PRODUCTION_ENV = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
  JWT_SECRET: "legacy-decryption-test-key",
  DATABASE_URL: "postgresql://runtime.invalid/site-launchpad",
  BUILT_IN_FORGE_API_URL: "https://forge.invalid",
  BUILT_IN_FORGE_API_KEY: "forge-test-key",
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

afterEach(() => {
  vi.unstubAllEnvs();
});

function loadVercelConfig(): VercelConfig {
  return JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "../../vercel.json"), "utf8"),
  ) as VercelConfig;
}

function vercelSourceToRegExp(source: string): RegExp {
  return new RegExp(`^${source}$`);
}

function applyOfficialRewrite(
  pathname: string,
  search: string,
  rewrite: VercelRewrite,
): { pathname: string; search: string } | null {
  const matched = pathname.match(vercelSourceToRegExp(rewrite.source));
  if (!matched) {
    return null;
  }

  let pathnameOut = rewrite.destination;
  const namedTokens = [...rewrite.destination.matchAll(/:([A-Za-z0-9_]+)\*?/g)].map(
    token => token[1],
  );
  const sourceTokens = [...rewrite.source.matchAll(/:([A-Za-z0-9_]+)\*?/g)].map(token => token[1]);

  if (rewrite.destination.includes("$1") && matched[1] !== undefined) {
    pathnameOut = rewrite.destination.replace("$1", matched[1]);
  }

  for (const token of namedTokens) {
    const value = matched.groups?.[token] ?? matched[1] ?? "";
    pathnameOut = pathnameOut.replace(new RegExp(`:${token}\\*?`), value);
  }

  const unusedTokens = sourceTokens.filter(token => !namedTokens.includes(token));
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (unusedTokens.length > 0 && matched[1] !== undefined) {
    params.set(unusedTokens[0] ?? "path", matched[1]);
  }

  const nextSearch = params.toString() ? `?${params.toString()}` : "";
  return { pathname: pathnameOut, search: nextSearch };
}

function matchApiFunction(pathname: string): string | null {
  const files = existsSync(API_DIRECTORY)
    ? readdirSync(API_DIRECTORY).filter(name => !name.startsWith("_") && !name.startsWith("."))
    : [];

  if ((pathname === "/api" || pathname === "/api/") && files.includes("index.ts")) {
    return "api/index.ts";
  }

  if (pathname.startsWith("/api/") && pathname !== "/api/" && files.includes("[...path].ts")) {
    return "api/[...path].ts";
  }

  return null;
}

function routeVercelRequest(
  url: string,
  staticFiles: ReadonlySet<string> = new Set(),
): RoutedRequest {
  const parsed = new URL(url, "https://site-launchpad.example");
  const pathname = parsed.pathname;
  const search = parsed.search;
  const config = loadVercelConfig();

  const functionFile = matchApiFunction(pathname);
  if (functionFile) {
    return { kind: "function", file: functionFile, url: `${pathname}${search}` };
  }

  if (staticFiles.has(pathname)) {
    return { kind: "static-cdn", pathname };
  }

  for (const rewrite of config.rewrites) {
    const applied = applyOfficialRewrite(pathname, search, rewrite);
    if (!applied) {
      continue;
    }
    if (applied.pathname === "/index.html") {
      return { kind: "spa", pathname: "/index.html" };
    }
    return {
      kind: "function",
      file: matchApiFunction(applied.pathname) ?? "api/index.ts",
      url: `${applied.pathname}${applied.search}`,
    };
  }

  throw new Error(`No Vercel route matched ${pathname}`);
}

async function dispatchToExpress(url: string, method: "get" | "post" = "get") {
  const seen: string[] = [];
  const app = await createApp({ mode: "production", serveClientAssets: false });
  const probe = express();
  probe.use((request, _response, next) => {
    seen.push(`${request.method} ${request.originalUrl}`);
    next();
  });
  probe.use(app);

  const agent = request(probe);
  const response =
    method === "post"
      ? await agent
          .post(url)
          .set("Content-Type", "application/json")
          .send({ json: { timestamp: 0 } })
      : await agent.get(url);

  return { response, seen };
}

describe("Vercel production-equivalent routing", () => {
  it("delivers /api/trpc/system.health to Express with the original pathname and query", async () => {
    setProductionEnv();
    const routed = routeVercelRequest(HEALTH_PATH);

    expect(routed.kind).toBe("function");
    if (routed.kind !== "function") {
      return;
    }
    expect(routed.url.startsWith("/api/trpc/system.health?")).toBe(true);
    expect(routed.url).toContain("input=");
    expect(routed.url).not.toMatch(/^\/api\?/);

    const { response, seen } = await dispatchToExpress(routed.url);
    expect(seen).toContain(`GET ${routed.url}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      result: { data: { json: { ok: true } } },
    });
    expect(response.text).not.toContain("<html");
  });

  it("keeps tRPC POST bodies intact on the preserved pathname", async () => {
    setProductionEnv();
    const routed = routeVercelRequest("/api/trpc/system.health");
    expect(routed.kind).toBe("function");
    if (routed.kind !== "function") {
      return;
    }
    expect(routed.url).toBe("/api/trpc/system.health");

    const { response, seen } = await dispatchToExpress(routed.url, "post");
    expect(seen).toContain("POST /api/trpc/system.health");
    expect(response.status).not.toBe(404);
    expect(response.text).not.toContain("<html");
    expect(response.text).not.toContain("<!doctype html>");
    expect(JSON.stringify(response.body)).not.toEqual(
      JSON.stringify({ error: "Not Found" }),
    );
  });

  it("returns JSON 404 for unknown API paths and exact /api, never index.html", async () => {
    setProductionEnv();

    const unknown = routeVercelRequest("/api/not-a-route");
    expect(unknown.kind).toBe("function");
    if (unknown.kind === "function") {
      const { response } = await dispatchToExpress(unknown.url);
      expect(unknown.url).toBe("/api/not-a-route");
      expect(response.status).toBe(404);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({ error: "Not Found" });
      expect(response.text).not.toContain("<html");
    }

    const exactApi = routeVercelRequest("/api");
    expect(exactApi.kind).toBe("function");
    if (exactApi.kind === "function") {
      expect(exactApi.file).toBe("api/index.ts");
      expect(exactApi.url).toBe("/api");
      const { response } = await dispatchToExpress(exactApi.url);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Not Found" });
    }
  });

  it("keeps SPA refresh on index.html and existing assets on the CDN", () => {
    const config = loadVercelConfig();
    expect(config.outputDirectory).toBe("dist/public");
    expect(config.framework).toBeNull();

    expect(routeVercelRequest("/clients/new")).toEqual({
      kind: "spa",
      pathname: "/index.html",
    });
    expect(routeVercelRequest("/workspace/12/pages")).toEqual({
      kind: "spa",
      pathname: "/index.html",
    });
    expect(routeVercelRequest("/auth/callback")).toEqual({
      kind: "spa",
      pathname: "/index.html",
    });
    expect(
      routeVercelRequest("/assets/index-CATk06fW.css", new Set(["/assets/index-CATk06fW.css"])),
    ).toEqual({
      kind: "static-cdn",
      pathname: "/assets/index-CATk06fW.css",
    });
    expect(routeVercelRequest("/api/trpc/system.health").kind).not.toBe("spa");
  });
});
