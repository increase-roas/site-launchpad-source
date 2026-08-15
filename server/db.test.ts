import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientSecretSetups } from "../drizzle/schema";
import { UpdateConflictError } from "./trpcErrors";

const seedMocks = vi.hoisted(() => ({
  seedWorkspaceDefaults: vi.fn(),
}));

vi.mock("./workspaceSeed", () => ({
  seedWorkspaceDefaults: seedMocks.seedWorkspaceDefaults,
}));

import {
  POSTGRES_RUNTIME_OPTIONS,
  createClientWithSecretsInTransaction,
  createDraftClientWithDb,
  createDraftClientInTransaction,
  resolveOptimisticUpdate,
} from "./db";

describe("PostgreSQL runtime configuration", () => {
  it("uses transaction-pooler-safe options without exposing a URL", () => {
    expect(POSTGRES_RUNTIME_OPTIONS).toEqual({ prepare: false, max: 1 });
    expect(POSTGRES_RUNTIME_OPTIONS).not.toHaveProperty("url");
    expect(JSON.stringify(POSTGRES_RUNTIME_OPTIONS)).not.toContain("DATABASE_URL");
  });
});

describe("optimistic client updates", () => {
  it("treats a matching update as success", () => {
    expect(() => resolveOptimisticUpdate([{ id: 7 }], undefined)).not.toThrow();
  });

  it("maps zero rows with a missing client to not found", () => {
    expect(() => resolveOptimisticUpdate([], undefined)).toThrow("Client not found.");
  });

  it("maps zero rows with a still-present client to conflict", () => {
    expect(() => resolveOptimisticUpdate([], { id: 7 })).toThrow(UpdateConflictError);
  });
});

describe("createClientWithSecretsInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks.seedWorkspaceDefaults.mockResolvedValue(undefined);
  });

  it("inserts the client, secrets, and workspace defaults in one transaction", async () => {
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: async () => [{ id: 42 }],
          onConflictDoUpdate,
        })),
      })),
    };

    const clientId = await createClientWithSecretsInTransaction(
      tx as never,
      { businessName: "Paradise Spas", shortName: "Paradise" } as never,
      { metaPixelIdEncrypted: "v2.secret" },
    );

    expect(clientId).toBe(42);
    expect(seedMocks.seedWorkspaceDefaults).toHaveBeenCalledWith(tx, 42);
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: clientSecretSetups.clientId,
      set: expect.objectContaining({
        metaPixelIdEncrypted: "v2.secret",
        updatedAt: expect.any(Date),
      }),
    });
  });

  it("lets the caller roll back when workspace seed fails after the client insert", async () => {
    seedMocks.seedWorkspaceDefaults.mockRejectedValue(new Error("workspace boom"));
    const committed: string[] = [];
    const tx = {
      insert: () => ({
        values: () => ({
          returning: async () => {
            committed.push("client");
            return [{ id: 9 }];
          },
          onConflictDoUpdate: async () => {
            committed.push("secrets");
          },
        }),
      }),
    };

    async function runTransaction<T>(fn: (inner: typeof tx) => Promise<T>): Promise<T> {
      try {
        return await fn(tx);
      } catch (error) {
        committed.length = 0;
        throw error;
      }
    }

    await expect(
      runTransaction(inner =>
        createClientWithSecretsInTransaction(
          inner as never,
          { businessName: "Paradise Spas", shortName: "Paradise" } as never,
          { metaPixelIdEncrypted: "v2.secret" },
        ),
      ),
    ).rejects.toThrow("workspace boom");
    expect(committed).toEqual([]);
  });
});

describe("createDraftClientInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks.seedWorkspaceDefaults.mockResolvedValue(undefined);
  });

  it("rolls back the draft client when workspace seeding fails", async () => {
    seedMocks.seedWorkspaceDefaults.mockRejectedValue(new Error("workspace boom"));
    const committed: string[] = [];
    const tx = {
      select: () => ({
        from: () => Promise.resolve([]),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => {
            committed.push("client");
            return [{ id: 77 }];
          },
        }),
      }),
    };

    async function runTransaction<T>(fn: (inner: typeof tx) => Promise<T>): Promise<T> {
      try {
        return await fn(tx);
      } catch (error) {
        committed.length = 0;
        throw error;
      }
    }

    await expect(
      runTransaction(inner =>
        createDraftClientInTransaction(inner as never, "Northland Spas"),
      ),
    ).rejects.toThrow("workspace boom");
    expect(seedMocks.seedWorkspaceDefaults).toHaveBeenCalledWith(tx, 77);
    expect(committed).toEqual([]);
  });

  it("uses the production transaction wrapper for allocation, insert, and workspace seed", async () => {
    const tx = {
      select: () => ({
        from: () => Promise.resolve([]),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [{ id: 78 }],
        }),
      }),
    };
    const db = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<number>) =>
        callback(tx),
      ),
    };

    await expect(createDraftClientWithDb(db as never, "Northland Spas")).resolves.toBe(78);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(seedMocks.seedWorkspaceDefaults).toHaveBeenCalledWith(tx, 78);
  });
});
