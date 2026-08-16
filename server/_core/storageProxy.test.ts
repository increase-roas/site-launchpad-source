import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const authMocks = vi.hoisted(() => ({
  authenticateSupabaseRequest: vi.fn(),
}));

vi.mock("./supabaseAuth", () => ({
  authenticateSupabaseRequest: authMocks.authenticateSupabaseRequest,
}));

import {
  createStorageProxyDependencies,
  handleStorageProxyGet,
} from "./storageProxy";

function mockRes() {
  const res = {
    statusCode: 200,
    body: "",
    redirected: null as { code: number; url: string } | null,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
    set(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    redirect(code: number, url: string) {
      this.redirected = { code, url };
      return this;
    },
  };
  return res as typeof res & Response;
}

describe("storage proxy handler", () => {
  it("uses the shared Supabase Bearer authentication boundary", async () => {
    const req = {
      headers: { authorization: "Bearer signed-token" },
    } as Request;
    authMocks.authenticateSupabaseRequest.mockResolvedValueOnce({ id: 1 });

    await createStorageProxyDependencies().authenticate(req);

    expect(authMocks.authenticateSupabaseRequest).toHaveBeenCalledWith(req);
  });

  it("returns 401 and does not call Forge without a session", async () => {
    const fetchFn = vi.fn();
    const res = mockRes();
    await handleStorageProxyGet(
      { params: { 0: "clients/5-acme/hero.webp" }, path: "/manus-storage/clients/5-acme/hero.webp" } as unknown as Request,
      res,
      {
        authenticate: async () => {
          throw new Error("Invalid session cookie");
        },
        fetchFn: fetchFn as unknown as typeof fetch,
        forgeApiUrl: "https://forge.example.test",
        forgeApiKey: "forge-key",
      },
    );
    expect(res.statusCode).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns 400 for traversal keys even when authenticated", async () => {
    const fetchFn = vi.fn();
    const res = mockRes();
    await handleStorageProxyGet(
      { params: { 0: "clients/../secret" }, path: "/manus-storage/clients/../secret" } as unknown as Request,
      res,
      {
        authenticate: async () => ({ id: 1 }),
        fetchFn: fetchFn as unknown as typeof fetch,
        forgeApiUrl: "https://forge.example.test",
        forgeApiKey: "forge-key",
      },
    );
    expect(res.statusCode).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("redirects 307 to an allowlisted host", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://bucket.s3.amazonaws.com/obj" }),
    });
    const res = mockRes();
    await handleStorageProxyGet(
      { params: { 0: "clients/5-acme/hero.webp" }, path: "/manus-storage/clients/5-acme/hero.webp" } as unknown as Request,
      res,
      {
        authenticate: async () => ({ id: 1 }),
        fetchFn: fetchFn as unknown as typeof fetch,
        forgeApiUrl: "https://forge.example.test",
        forgeApiKey: "forge-key",
      },
    );
    expect(res.redirected).toEqual({ code: 307, url: "https://bucket.s3.amazonaws.com/obj" });
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("returns 502 when Forge points at an unexpected host", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://evil.example/obj" }),
    });
    const res = mockRes();
    await handleStorageProxyGet(
      { params: { 0: "clients/5-acme/hero.webp" }, path: "/manus-storage/clients/5-acme/hero.webp" } as unknown as Request,
      res,
      {
        authenticate: async () => ({ id: 1 }),
        fetchFn: fetchFn as unknown as typeof fetch,
        forgeApiUrl: "https://forge.example.test",
        forgeApiKey: "forge-key",
      },
    );
    expect(res.statusCode).toBe(502);
    expect(res.redirected).toBeNull();
  });
});
