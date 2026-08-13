import { afterEach, describe, expect, it, vi } from "vitest";

describe("fail-closed session secret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to encode an empty JWT secret", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();
    const { requireCookieSecret } = await import("./_core/env");
    expect(() => requireCookieSecret()).toThrow(/JWT_SECRET/);
  });

  it("returns a configured secret", async () => {
    vi.stubEnv("JWT_SECRET", "configured-session-secret");
    vi.resetModules();
    const { requireCookieSecret } = await import("./_core/env");
    expect(requireCookieSecret()).toBe("configured-session-secret");
  });
});

describe("upsertUser without a database", () => {
  it("throws instead of returning", async () => {
    const previousUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { upsertUser } = await import("./db");
    await expect(
      upsertUser({
        openId: "user-1",
        name: "Test",
        email: "test@example.com",
        loginMethod: "manus",
      }),
    ).rejects.toThrow(/database/i);
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  });
});
