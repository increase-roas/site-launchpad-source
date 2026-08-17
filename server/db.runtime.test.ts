import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
  postgres: vi.fn(),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: databaseMocks.drizzle,
}));

vi.mock("postgres", () => ({
  default: databaseMocks.postgres,
}));

import { upsertUser } from "./db";

const synchronizedUser = {
  id: 7,
  authUserId: "123e4567-e89b-12d3-a456-426614174000",
  email: "operator@example.com",
  name: "Site Operator",
  loginMethod: "google" as const,
  role: "user" as const,
  createdAt: new Date("2026-08-17T00:00:00.000Z"),
  updatedAt: new Date("2026-08-17T00:00:00.000Z"),
  lastSignedIn: new Date("2026-08-17T00:00:00.000Z"),
};

function databaseReturning(result: Promise<typeof synchronizedUser[]>) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => result),
        })),
      })),
    })),
  };
}

describe("database operation resilience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user:runtime-password@runtime.invalid/site-launchpad",
    );
    databaseMocks.drizzle.mockReset();
    databaseMocks.postgres.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("expires a never-settling operation and gives the next operation a fresh runtime", async () => {
    const neverSettles = new Promise<typeof synchronizedUser[]>(() => undefined);
    const firstDatabase = databaseReturning(neverSettles);
    const secondDatabase = databaseReturning(Promise.resolve([synchronizedUser]));
    const firstClient = {
      end: vi.fn(async () => undefined),
    };
    const secondClient = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    databaseMocks.drizzle
      .mockReturnValueOnce(firstDatabase)
      .mockReturnValueOnce(secondDatabase);

    const firstAttempt = upsertUser({
      authUserId: synchronizedUser.authUserId,
      email: synchronizedUser.email,
      name: synchronizedUser.name,
      loginMethod: synchronizedUser.loginMethod,
      role: synchronizedUser.role,
      lastSignedIn: synchronizedUser.lastSignedIn,
    });
    const firstFailure = vi.fn();
    void firstAttempt.catch(firstFailure);

    await vi.advanceTimersByTimeAsync(20_000);

    expect(firstFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "DatabaseOperationTimeoutError",
      }),
    );
    expect(firstClient.end).toHaveBeenCalledWith({ timeout: 0 });

    await expect(
      upsertUser({
        authUserId: synchronizedUser.authUserId,
        email: synchronizedUser.email,
        name: synchronizedUser.name,
        loginMethod: synchronizedUser.loginMethod,
        role: synchronizedUser.role,
        lastSignedIn: synchronizedUser.lastSignedIn,
      }),
    ).resolves.toEqual(synchronizedUser);
    expect(databaseMocks.postgres).toHaveBeenCalledTimes(2);
  });
});
