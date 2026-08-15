import express from "express";
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

const PRODUCTION_ENV_NAMES = [
  "VITE_APP_ID",
  "JWT_SECRET",
  "DATABASE_URL",
  "OAUTH_SERVER_URL",
  "OWNER_OPEN_ID",
  "BUILT_IN_FORGE_API_URL",
  "BUILT_IN_FORGE_API_KEY",
  "SECRETS_ENCRYPTION_KEY",
] as const;

function setProductionEnv(): void {
  for (const name of PRODUCTION_ENV_NAMES) {
    vi.stubEnv(name, `configured-${name.toLowerCase()}`);
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

  it("does not evaluate development Vite in production", async () => {
    setProductionEnv();
    const { createApp } = await import("./app");

    await createApp({ mode: "production" });

    expect(viteEvaluation.evaluated).toBe(false);
  });

  it("reports only missing production environment variable names", async () => {
    for (const name of PRODUCTION_ENV_NAMES) {
      vi.stubEnv(name, "");
    }
    const configuredValue = "configured-value-must-not-leak";
    vi.stubEnv("VITE_APP_ID", configuredValue);
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
      const apiModule = await import("../../api/index");

      expect(apiModule.default).toBeTypeOf("function");
      expect(expressListen).not.toHaveBeenCalled();
      expect(netListen).not.toHaveBeenCalled();
    } finally {
      expressListen.mockRestore();
      netListen.mockRestore();
    }
  });
});
