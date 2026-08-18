import { DrizzleQueryError } from "drizzle-orm/errors";
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

type DatabaseModule = typeof import("./db");

let database: DatabaseModule;

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
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user:runtime-password@runtime.invalid/site-launchpad",
    );
    databaseMocks.drizzle.mockReset();
    databaseMocks.postgres.mockReset();
    vi.resetModules();
    database = await import("./db");
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

    const firstAttempt = database.upsertUser({
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
        name: "RetryableDatabaseError",
        message: "The database is temporarily unavailable. Please try again.",
        classification: "timeout",
      }),
    );
    expect(firstClient.end).toHaveBeenCalledWith({ timeout: 0 });

    await expect(
      database.upsertUser({
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

  it("bounds draft creation through the shared operation deadline", async () => {
    const runtimeDatabase = {
      transaction: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const client = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres.mockReturnValue(client);
    databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

    const attempt = database.createDraftClient("Northland Spas");
    const failure = vi.fn();
    void attempt.catch(failure);

    await vi.advanceTimersByTimeAsync(database.DATABASE_OPERATION_TIMEOUT_MS);

    expect(failure).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "RetryableDatabaseError",
        message: "The database is temporarily unavailable. Please try again.",
        classification: "timeout",
      }),
    );
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("runs clients.list reads sequentially inside one max-one operation", async () => {
    let activeReads = 0;
    let maxConcurrentReads = 0;
    const readOrder: string[] = [];
    let tableIndex = 0;
    const trackRead = async <T>(name: string, value: T): Promise<T> => {
      activeReads += 1;
      maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);
      readOrder.push(name);
      await Promise.resolve();
      activeReads -= 1;
      return value;
    };
    const runtimeDatabase = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          const currentTableIndex = tableIndex;
          tableIndex += 1;
          if (currentTableIndex === 0) {
            return {
              orderBy: () => trackRead("clients", []),
            };
          }
          if (currentTableIndex === 1) {
            return trackRead("assets", []);
          }
          if (currentTableIndex === 2) {
            return trackRead("secretSetups", []);
          }
          if (currentTableIndex === 3) {
            return trackRead("integrationProfiles", []);
          }
          if (currentTableIndex === 4) {
            return trackRead("websitePublishes", []);
          }
          if (currentTableIndex === 5) {
            return trackRead("funnels", []);
          }
          if (currentTableIndex === 6) {
            return trackRead("simpleFormPublishes", []);
          }
          if (currentTableIndex === 7) {
            return trackRead("genericFunnelPublishes", []);
          }
          throw new Error("Unexpected table.");
        }),
      })),
    };
    const client = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres.mockReturnValue(client);
    databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

    await expect(database.listClientViewData()).resolves.toEqual({
      clients: [],
      assets: [],
      secretSetups: [],
      integrationProfiles: [],
      websitePublishes: [],
      funnels: [],
      simpleFormPublishes: [],
      genericFunnelPublishes: [],
    });

    expect(database.POSTGRES_RUNTIME_OPTIONS.max).toBe(1);
    expect(maxConcurrentReads).toBe(1);
    expect(readOrder).toEqual([
      "clients",
      "assets",
      "secretSetups",
      "integrationProfiles",
      "websitePublishes",
      "funnels",
      "simpleFormPublishes",
      "genericFunnelPublishes",
    ]);
    expect(client.end).not.toHaveBeenCalled();
  });

  it("bounds every read used to build one client view", async () => {
    const neverSettles = new Promise<never>(() => undefined);
    const runtimeDatabase = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => neverSettles),
          })),
        })),
      })),
    };
    const client = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres.mockReturnValue(client);
    databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

    const attempt = database.getClientViewData(7);
    const failure = vi.fn();
    void attempt.catch(failure);

    await vi.advanceTimersByTimeAsync(database.DATABASE_OPERATION_TIMEOUT_MS);

    expect(failure).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "RetryableDatabaseError",
        classification: "timeout",
      }),
    );
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CONNECTION_CLOSED", "database_connection"],
    ["CONNECTION_DESTROYED", "database_connection"],
    ["57014", "database_statement_timeout"],
  ] as const)(
    "normalizes %s without exposing driver details",
    async (code, classification) => {
      const unsafeDetail =
        "INSERT INTO users VALUES ($1) -- postgresql://private-user:private-password@private-host/database";
      const runtimeDatabase = databaseReturning(
        Promise.reject(Object.assign(new Error(unsafeDetail), { code })),
      );
      const client = {
        end: vi.fn(async () => undefined),
      };
      databaseMocks.postgres.mockReturnValue(client);
      databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

      const failure = await database
        .upsertUser({
          authUserId: synchronizedUser.authUserId,
          email: synchronizedUser.email,
          name: synchronizedUser.name,
          loginMethod: synchronizedUser.loginMethod,
          role: synchronizedUser.role,
          lastSignedIn: synchronizedUser.lastSignedIn,
        })
        .catch((error: unknown) => error);

      expect(failure).toMatchObject({
        name: "RetryableDatabaseError",
        message: "The database is temporarily unavailable. Please try again.",
        classification,
      });
      expect(JSON.stringify(failure)).not.toContain(unsafeDetail);
      expect(client.end).toHaveBeenCalledTimes(1);
    },
  );

  it("normalizes a real DrizzleQueryError with a retryable nested cause", async () => {
    const fakeSql =
      "insert into fake_sensitive_table (secret_value) values ($1)";
    const fakeParameter = "fake-parameter-must-not-escape";
    const wrappedFailure = new DrizzleQueryError(
      fakeSql,
      [fakeParameter],
      Object.assign(new Error("driver hostname must not escape"), {
        code: "CONNECTION_CLOSED",
      }),
    );
    const runtimeDatabase = databaseReturning(Promise.reject(wrappedFailure));
    const client = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres.mockReturnValue(client);
    databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

    const failure = await database
      .upsertUser({
        authUserId: synchronizedUser.authUserId,
        email: synchronizedUser.email,
        name: synchronizedUser.name,
        loginMethod: synchronizedUser.loginMethod,
        role: synchronizedUser.role,
        lastSignedIn: synchronizedUser.lastSignedIn,
      })
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({
      name: "RetryableDatabaseError",
      message: "The database is temporarily unavailable. Please try again.",
      classification: "database_connection",
    });
    expect(client.end).toHaveBeenCalledTimes(1);
    for (const forbiddenDetail of [
      "Failed query",
      "params:",
      fakeSql,
      fakeParameter,
    ]) {
      expect(failure instanceof Error ? failure.message : String(failure)).not.toContain(
        forbiddenDetail,
      );
    }
  });

  it("preserves a wrapped non-retryable application error", async () => {
    const wrappedFailure = new DrizzleQueryError(
      "insert into clients (short_name) values ($1)",
      ["duplicate-short-name"],
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );
    const runtimeDatabase = databaseReturning(Promise.reject(wrappedFailure));
    const client = {
      end: vi.fn(async () => undefined),
    };
    databaseMocks.postgres.mockReturnValue(client);
    databaseMocks.drizzle.mockReturnValue(runtimeDatabase);

    await expect(
      database.upsertUser({
        authUserId: synchronizedUser.authUserId,
        email: synchronizedUser.email,
        name: synchronizedUser.name,
        loginMethod: synchronizedUser.loginMethod,
        role: synchronizedUser.role,
        lastSignedIn: synchronizedUser.lastSignedIn,
      }),
    ).rejects.toBe(wrappedFailure);
    expect(client.end).not.toHaveBeenCalled();
  });

  it("discards a shared broken runtime once and cannot close its replacement", async () => {
    const connectionFailure = Object.assign(
      new Error("connection detail must not escape"),
      { code: "CONNECTION_CLOSED" },
    );
    const firstDatabase = databaseReturning(Promise.reject(connectionFailure));
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
    const input = {
      authUserId: synchronizedUser.authUserId,
      email: synchronizedUser.email,
      name: synchronizedUser.name,
      loginMethod: synchronizedUser.loginMethod,
      role: synchronizedUser.role,
      lastSignedIn: synchronizedUser.lastSignedIn,
    };

    const failures = await Promise.allSettled([
      database.upsertUser(input),
      database.upsertUser(input),
    ]);

    expect(failures).toEqual([
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ name: "RetryableDatabaseError" }),
      }),
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ name: "RetryableDatabaseError" }),
      }),
    ]);
    expect(firstClient.end).toHaveBeenCalledTimes(1);

    await expect(database.upsertUser(input)).resolves.toEqual(synchronizedUser);
    expect(secondClient.end).not.toHaveBeenCalled();
  });
});
