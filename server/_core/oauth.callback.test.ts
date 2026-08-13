import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, OAUTH_STATE_COOKIE, encodeOAuthState } from "../../shared/const";

const mocks = vi.hoisted(() => ({
  upsertUser: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("../db", () => ({ upsertUser: mocks.upsertUser }));
vi.mock("./sdk", () => ({
  sdk: {
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
    createSessionToken: mocks.createSessionToken,
  },
}));

import { handleOAuthCallback } from "./oauth";
import type { Request, Response } from "express";

function mockRes() {
  const cookies: Array<{ name: string; value: string }> = [];
  const jsonBodies: unknown[] = [];
  const res = {
    statusCode: 200,
    redirected: null as string | null,
    cookie(name: string, value: string) {
      cookies.push({ name, value });
      return this;
    },
    clearCookie() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBodies.push(body);
      return this;
    },
    redirect(_code: number, url: string) {
      this.redirected = url;
      return this;
    },
  };
  return { res: res as typeof res & Response, cookies, jsonBodies };
}

describe("oauth callback persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "token" });
    mocks.getUserInfo.mockResolvedValue({
      openId: "user-1",
      name: "Test",
      email: "test@example.com",
      loginMethod: "manus",
    });
    mocks.createSessionToken.mockResolvedValue("session-token");
  });

  it("does not set a session cookie when upsertUser fails", async () => {
    mocks.upsertUser.mockRejectedValue(new Error("Database is not available."));
    const nonce = "nonce-1";
    const state = encodeOAuthState({ redirectUri: "https://app.example/api/oauth/callback", nonce });
    const { res, cookies, jsonBodies } = mockRes();
    await handleOAuthCallback(
      {
        query: { code: "abc", state },
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(500);
    expect(jsonBodies[0]).toEqual({ error: "OAuth callback failed" });
    expect(cookies.some(cookie => cookie.name === COOKIE_NAME)).toBe(false);
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("sets the session cookie after the user row persists", async () => {
    mocks.upsertUser.mockResolvedValue(undefined);
    const nonce = "nonce-2";
    const state = encodeOAuthState({ redirectUri: "https://app.example/api/oauth/callback", nonce });
    const { res, cookies } = mockRes();
    await handleOAuthCallback(
      {
        query: { code: "abc", state },
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` },
      } as unknown as Request,
      res,
    );
    expect(res.redirected).toBe("/");
    expect(cookies.some(cookie => cookie.name === COOKIE_NAME && cookie.value === "session-token")).toBe(true);
  });
});
