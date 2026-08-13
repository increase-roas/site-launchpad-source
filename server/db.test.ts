import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateConflictError } from "./trpcErrors";

const seedMocks = vi.hoisted(() => ({
  seedWorkspaceDefaults: vi.fn(),
}));

vi.mock("./workspaceSeed", () => ({
  seedWorkspaceDefaults: seedMocks.seedWorkspaceDefaults,
}));

import {
  createClientWithSecretsInTransaction,
  mysqlAffectedRows,
  resolveOptimisticUpdate,
} from "./db";

describe("optimistic client updates", () => {
  it("reads affectedRows from a mysql2 result tuple", () => {
    expect(mysqlAffectedRows([{ affectedRows: 1 }, []])).toBe(1);
    expect(mysqlAffectedRows([{ affectedRows: 0 }, []])).toBe(0);
    expect(mysqlAffectedRows({ affectedRows: 2 })).toBe(2);
  });

  it("treats a matching update as success", () => {
    expect(() => resolveOptimisticUpdate(1, { id: 7 })).not.toThrow();
  });

  it("maps zero rows with a missing client to not found", () => {
    expect(() => resolveOptimisticUpdate(0, undefined)).toThrow("Client not found.");
  });

  it("maps zero rows with a still-present client to conflict", () => {
    expect(() => resolveOptimisticUpdate(0, { id: 7 })).toThrow(UpdateConflictError);
  });
});

describe("createClientWithSecretsInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks.seedWorkspaceDefaults.mockResolvedValue(undefined);
  });

  it("inserts the client, secrets, and workspace defaults in one transaction", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          $returningId: async () => [{ id: 42 }],
          onDuplicateKeyUpdate: async () => undefined,
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
  });

  it("lets the caller roll back when workspace seed fails after the client insert", async () => {
    seedMocks.seedWorkspaceDefaults.mockRejectedValue(new Error("workspace boom"));
    const committed: string[] = [];
    const tx = {
      insert: () => ({
        values: () => ({
          $returningId: async () => {
            committed.push("client");
            return [{ id: 9 }];
          },
          onDuplicateKeyUpdate: async () => {
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
