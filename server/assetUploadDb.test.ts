import { describe, expect, it, vi } from "vitest";
import { assetUploadSessions, clientAssets } from "../drizzle/schema";
import {
  finalizeAssetUploadInTransaction,
  finalizeAssetUploadWithDb,
} from "./assetUploadDb";

const completedAt = new Date("2026-08-15T12:00:00.000Z");
const input = {
  uploadId: "123e4567-e89b-12d3-a456-426614174000",
  completedAt,
  asset: {
    clientId: 7,
    slot: "hero" as const,
    storageKey: "clients/7-test/assets/hero-hash-version.webp",
    storageUrl: "https://assets.example.com/clients/7-test/assets/hero-hash-version.webp",
    filename: "hero.webp",
    originalFilename: "hero.png",
    mimeType: "image/webp",
    byteSize: 100,
    width: 1200,
    height: 800,
  },
};

function makeTransaction(status: "pending" | "completed" = "pending") {
  const events: string[] = [];
  const select = vi.fn()
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(async () => {
            events.push("lock-session");
            return [{
              id: input.uploadId,
              status,
              expiresAt: new Date(completedAt.getTime() + 60_000),
            }];
          }),
        })),
      })),
    })
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            events.push("read-previous");
            return [{ storageKey: "clients/7-test/assets/hero-old.webp" }];
          }),
        })),
      })),
    });
  const onConflictDoUpdate = vi.fn(async () => {
    events.push("upsert-asset");
  });
  const insert = vi.fn(table => {
    expect(table).toBe(clientAssets);
    return {
      values: vi.fn(() => ({ onConflictDoUpdate })),
    };
  });
  const returning = vi.fn(async () => {
    events.push("complete-session");
    return [{ id: input.uploadId }];
  });
  const update = vi.fn(table => {
    expect(table).toBe(assetUploadSessions);
    return {
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning })),
      })),
    };
  });

  return { transaction: { select, insert, update }, events, onConflictDoUpdate };
}

describe("asset upload transaction", () => {
  it("locks the session, swaps the asset, and marks completion atomically", async () => {
    const fixture = makeTransaction();

    const result = await finalizeAssetUploadInTransaction(
      fixture.transaction as never,
      input,
    );

    expect(result).toEqual({
      previousStorageKey: "clients/7-test/assets/hero-old.webp",
    });
    expect(fixture.events).toEqual([
      "lock-session",
      "read-previous",
      "upsert-asset",
      "complete-session",
    ]);
    expect(fixture.onConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.any(Array),
      set: expect.objectContaining({
        storageKey: input.asset.storageKey,
        storageUrl: input.asset.storageUrl,
        updatedAt: expect.any(Date),
      }),
    });
  });

  it("rejects replay before changing the asset pointer", async () => {
    const fixture = makeTransaction("completed");

    await expect(
      finalizeAssetUploadInTransaction(fixture.transaction as never, input),
    ).rejects.toThrow("no longer pending");
    expect(fixture.transaction.insert).not.toHaveBeenCalled();
    expect(fixture.transaction.update).not.toHaveBeenCalled();
  });

  it("uses the database transaction wrapper", async () => {
    const fixture = makeTransaction();
    const database = {
      transaction: vi.fn(async callback => callback(fixture.transaction)),
    };

    await finalizeAssetUploadWithDb(database as never, input);

    expect(database.transaction).toHaveBeenCalledOnce();
  });
});
