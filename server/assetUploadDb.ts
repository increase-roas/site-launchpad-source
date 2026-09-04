import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  assetUploadSessions,
  clientAssets,
  clientMediaItems,
  type AssetUploadSession,
  type ClientMediaItem,
  type InsertAssetUploadSession,
  type InsertClientAsset,
  type InsertClientMediaItem,
} from "../drizzle/schema";
import { getDb, getClientById } from "./db";
import { postgresConflictTargets, withUpdatedAt } from "./postgresPersistence";

export type AssetUploadDatabase = ReturnType<typeof drizzle>;

export type FinalizeAssetUploadInput = {
  uploadId: string;
  asset: InsertClientAsset | null;
  mediaItem: InsertClientMediaItem;
  completedAt: Date;
};

export type FinalizeAssetUploadResult = {
  previousStorageKey: string | null;
  mediaItem: ClientMediaItem;
};

async function requireAssetUploadDatabase(): Promise<AssetUploadDatabase> {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable.");
  return database;
}

export async function createUploadSession(
  values: InsertAssetUploadSession,
): Promise<void> {
  const database = await requireAssetUploadDatabase();
  await database.insert(assetUploadSessions).values(values);
}

export async function getUploadSession(
  uploadId: string,
): Promise<AssetUploadSession | undefined> {
  const database = await requireAssetUploadDatabase();
  const rows = await database
    .select()
    .from(assetUploadSessions)
    .where(eq(assetUploadSessions.id, uploadId))
    .limit(1);
  return rows[0];
}

export async function markUploadSessionFailed(uploadId: string): Promise<void> {
  const database = await requireAssetUploadDatabase();
  await database
    .update(assetUploadSessions)
    .set(withUpdatedAt({ status: "failed" as const }))
    .where(
      and(
        eq(assetUploadSessions.id, uploadId),
        eq(assetUploadSessions.status, "pending"),
      ),
    );
}

export async function finalizeAssetUploadInTransaction(
  transaction: AssetUploadDatabase,
  input: FinalizeAssetUploadInput,
): Promise<FinalizeAssetUploadResult> {
  const sessions = await transaction
    .select()
    .from(assetUploadSessions)
    .where(eq(assetUploadSessions.id, input.uploadId))
    .for("update");
  const session = sessions[0];
  if (
    !session ||
    session.status !== "pending" ||
    session.expiresAt.getTime() <= input.completedAt.getTime()
  ) {
    throw new Error("Upload session is no longer pending.");
  }

  const insertedItems = await transaction
    .insert(clientMediaItems)
    .values(input.mediaItem)
    .returning();
  const mediaItem = insertedItems[0];
  if (!mediaItem) throw new Error("The image could not be saved to the library.");

  let previousStorageKey: string | null = null;
  if (input.asset) {
    const previousRows = await transaction
      .select({ storageKey: clientAssets.storageKey })
      .from(clientAssets)
      .where(
        and(
          eq(clientAssets.clientId, input.asset.clientId),
          eq(clientAssets.slot, input.asset.slot),
        ),
      )
      .limit(1);
    previousStorageKey = previousRows[0]?.storageKey ?? null;

    await transaction
      .insert(clientAssets)
      .values({ ...input.asset, mediaItemId: mediaItem.id })
      .onConflictDoUpdate({
        target: postgresConflictTargets.clientAssets,
        set: withUpdatedAt({
          mediaItemId: mediaItem.id,
          storageKey: input.asset.storageKey,
          storageUrl: input.asset.storageUrl,
          filename: input.asset.filename,
          originalFilename: input.asset.originalFilename,
          mimeType: input.asset.mimeType,
          byteSize: input.asset.byteSize,
          width: input.asset.width,
          height: input.asset.height,
        }),
      });
  }

  const completed = await transaction
    .update(assetUploadSessions)
    .set(withUpdatedAt({
      status: "completed" as const,
      completedAt: input.completedAt,
    }))
    .where(
      and(
        eq(assetUploadSessions.id, input.uploadId),
        eq(assetUploadSessions.status, "pending"),
      ),
    )
    .returning({ id: assetUploadSessions.id });
  if (completed.length !== 1) {
    throw new Error("Upload session could not be completed.");
  }

  return { previousStorageKey, mediaItem };
}

export async function finalizeAssetUpload(
  input: FinalizeAssetUploadInput,
): Promise<FinalizeAssetUploadResult> {
  const database = await requireAssetUploadDatabase();
  return finalizeAssetUploadWithDb(database, input);
}

export async function finalizeAssetUploadWithDb(
  database: Pick<AssetUploadDatabase, "transaction">,
  input: FinalizeAssetUploadInput,
): Promise<FinalizeAssetUploadResult> {
  return database.transaction(transaction =>
    finalizeAssetUploadInTransaction(
      transaction as unknown as AssetUploadDatabase,
      input,
    ),
  );
}

export const assetUploadPersistence = {
  getClientById,
  createUploadSession,
  getUploadSession,
  markUploadSessionFailed,
  finalizeUpload: finalizeAssetUpload,
};
