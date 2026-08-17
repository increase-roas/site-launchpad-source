import express from "express";
import { createServer } from "node:http";
import { Server as NetServer } from "node:net";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const viteEvaluation = vi.hoisted(() => ({ evaluated: false }));

vi.mock("./vite", () => {
  viteEvaluation.evaluated = true;
  return {
    setupVite: vi.fn(),
  };
});

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

const PRODUCTION_ENV_NAMES = Object.keys(
  PRODUCTION_ENV,
) as Array<keyof typeof PRODUCTION_ENV>;

function setProductionEnv(): void {
  for (const name of PRODUCTION_ENV_NAMES) {
    vi.stubEnv(name, PRODUCTION_ENV[name]);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createApp", () => {
  it("imports and creates an app without calling Express listen", async () => {
    const expressListen = vi.spyOn(express.application, "listen");
    const netListen = vi.spyOn(NetServer.prototype, "listen");

    try {
      const { createApp } = await import("./app");

      await createApp({ mode: "test" });

      expect(expressListen).not.toHaveBeenCalled();
      expect(netListen).not.toHaveBeenCalled();
    } finally {
      expressListen.mockRestore();
      netListen.mockRestore();
    }
  });

  it("mounts the system.health tRPC route", async () => {
    const { createApp } = await import("./app");
    const app = await createApp({ mode: "test" });
    const input = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));

    const response = await request(app).get(`/api/trpc/system.health?input=${input}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      result: {
        data: {
          json: { ok: true },
        },
      },
    });
  });

  it("returns JSON 404 for an unknown API route", async () => {
    const { createApp } = await import("./app");
    const app = await createApp({ mode: "test" });

    const response = await request(app).get("/api/not-a-route");

    expect(response.status).toBe(404);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({ error: "Not Found" });
  });

  it("rejects API request bodies above five megabytes with safe JSON", async () => {
    const { createApp } = await import("./app");
    const app = await createApp({ mode: "test" });

    const response = await request(app)
      .post("/api/trpc/auth.me")
      .set("Content-Type", "application/json")
      .send({ oversized: "x".repeat(5 * 1024 * 1024) });

    expect(response.status).toBe(413);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({
      error: "Request body is too large. Maximum size is 4 MB.",
    });
    expect(response.text).not.toContain("PayloadTooLargeError");
    expect(response.text).not.toContain("stack");
  });

  it("does not expose the legacy Manus OAuth callback route", async () => {
    const { createApp } = await import("./app");
    const app = await createApp({ mode: "test" });

    const response = await request(app).get("/api/oauth/callback");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not Found" });
  });

  it("does not evaluate development Vite in production", async () => {
    setProductionEnv();
    const { createApp } = await import("./app");

    await createApp({ mode: "production" });

    expect(viteEvaluation.evaluated).toBe(false);
  });

  it("keeps local development on Vite and requires a development server", async () => {
    setProductionEnv();
    const { createApp } = await import("./app");

    await expect(createApp({ mode: "development" })).rejects.toThrow(
      "A developmentServer is required in development mode.",
    );

    const developmentServer = createServer();
    await createApp({ mode: "development", developmentServer });
    const { setupVite } = await import("./vite");
    expect(setupVite).toHaveBeenCalledWith(expect.anything(), developmentServer);
  });

  it("reports only missing production environment variable names", async () => {
    for (const name of PRODUCTION_ENV_NAMES) {
      vi.stubEnv(name, "");
    }
    const configuredValue = "configured-value-must-not-leak";
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", configuredValue);
    const { createApp } = await import("./app");

    let caught: unknown;
    try {
      await createApp({ mode: "production" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : "";
    expect(message).toContain("JWT_SECRET");
    expect(message).toContain("SECRETS_ENCRYPTION_KEY");
    expect(message).not.toContain("BUILT_IN_FORGE_API_URL");
    expect(message).not.toContain("BUILT_IN_FORGE_API_KEY");
    expect(message).not.toContain(configuredValue);
  });
});

describe("runtime mode", () => {
  it("defaults an absent mode to build and rejects unsupported nonempty values safely", async () => {
    const { deriveRuntimeMode } = await import("./env");
    const unsupportedValue = "staging-value-must-not-leak";
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      delete process.env.NODE_ENV;
      expect(deriveRuntimeMode()).toBe("build");
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
    expect(deriveRuntimeMode("")).toBe("build");

    let caught: unknown;
    try {
      deriveRuntimeMode(unsupportedValue);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : "";
    expect(message).toContain("NODE_ENV");
    expect(message).not.toContain(unsupportedValue);
  });
});

describe("Vercel handler", () => {
  it("imports without listening or requiring production environment variables", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const name of PRODUCTION_ENV_NAMES) {
      vi.stubEnv(name, "");
    }
    const expressListen = vi.spyOn(express.application, "listen");
    const netListen = vi.spyOn(NetServer.prototype, "listen");

    try {
      const apiModule = await import("./vercelApiHandler");

      expect(apiModule.default).toBeTypeOf("function");
      expect(expressListen).not.toHaveBeenCalled();
      expect(netListen).not.toHaveBeenCalled();
    } finally {
      expressListen.mockRestore();
      netListen.mockRestore();
    }
  });
});
