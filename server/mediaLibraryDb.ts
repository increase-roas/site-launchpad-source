import { and, eq } from "drizzle-orm";
import {
  astroClientConfigs,
  clientAssets,
  clientMediaItems,
  type InsertClientAsset,
} from "../drizzle/schema";
import { type AstroCategory } from "../shared/astroConfig";
import type { AssetUploadDatabase } from "./assetUploadDb";
import { getClientById, getDb } from "./db";
import {
  isMediaLibraryPlacement,
  mediaLibraryAssignmentError,
  toMediaLibraryItemDto,
  type MediaLibraryItemDto,
  type MediaLibraryPlacementKind,
} from "./mediaLibrary";
import { postgresConflictTargets, withUpdatedAt } from "./postgresPersistence";
import { normalizeMediaItemMetadata } from "../shared/mediaLibrary";

const CATEGORY_BY_SLOT: Record<string, AstroCategory> = {
  categoryHotTubs: "hot-tubs",
  categorySwimSpas: "swim-spas",
  categorySaunas: "saunas",
  categoryColdPlunge: "cold-plunge",
  categoryMassageChairs: "massage-chairs",
};

async function requireDb() {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable.");
  return database;
}

export async function listMediaLibrary(clientId: number): Promise<MediaLibraryItemDto[]> {
  const database = await requireDb();
  const [items, placements] = await Promise.all([
    database.select().from(clientMediaItems).where(eq(clientMediaItems.clientId, clientId)),
    database
      .select({
        mediaItemId: clientAssets.mediaItemId,
        slot: clientAssets.slot,
      })
      .from(clientAssets)
      .where(eq(clientAssets.clientId, clientId)),
  ]);
  const slotsByItem = new Map<number, string[]>();
  for (const placement of placements) {
    if (placement.mediaItemId == null) continue;
    const slots = slotsByItem.get(placement.mediaItemId) ?? [];
    slots.push(placement.slot);
    slotsByItem.set(placement.mediaItemId, slots);
  }
  return items
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(item => toMediaLibraryItemDto(item, slotsByItem.get(item.id) ?? []));
}

export async function updateMediaLibraryItem(input: {
  clientId: number;
  itemId: number;
  alt: string;
  description: string;
}): Promise<MediaLibraryItemDto> {
  const database = await requireDb();
  const copy = normalizeMediaItemMetadata(input);
  const updated = await database
    .update(clientMediaItems)
    .set(withUpdatedAt(copy))
    .where(and(
      eq(clientMediaItems.id, input.itemId),
      eq(clientMediaItems.clientId, input.clientId),
    ))
    .returning();
  if (updated.length !== 1) throw new Error("Image not found.");
  const items = await listMediaLibrary(input.clientId);
  const item = items.find(entry => entry.id === input.itemId);
  if (!item) throw new Error("Image not found.");
  return item;
}

export async function deleteMediaLibraryItem(input: {
  clientId: number;
  itemId: number;
}): Promise<{ storageKey: string }> {
  const database = await requireDb();
  return database.transaction(async transaction => {
    const items = await transaction
      .select()
      .from(clientMediaItems)
      .where(and(
        eq(clientMediaItems.id, input.itemId),
        eq(clientMediaItems.clientId, input.clientId),
      ))
      .limit(1);
    const item = items[0];
    if (!item) throw new Error("Image not found.");

    const placements = await transaction
      .select()
      .from(clientAssets)
      .where(and(
        eq(clientAssets.clientId, input.clientId),
        eq(clientAssets.mediaItemId, input.itemId),
      ));
    if (placements.length > 0) {
      await transaction
        .delete(clientAssets)
        .where(and(
          eq(clientAssets.clientId, input.clientId),
          eq(clientAssets.mediaItemId, input.itemId),
        ));
      for (const placement of placements) {
        await syncCategoryHeroImage(transaction, input.clientId, placement.slot, "");
      }
    }

    await transaction
      .delete(clientMediaItems)
      .where(eq(clientMediaItems.id, input.itemId));
    return { storageKey: item.storageKey };
  });
}

export async function assignMediaLibraryItem(input: {
  clientId: number;
  itemId: number;
  assetKind: MediaLibraryPlacementKind;
  slot: string;
}): Promise<MediaLibraryItemDto> {
  if (!isMediaLibraryPlacement(input.assetKind, input.slot)) {
    throw new Error("Choose a valid image placement.");
  }
  const database = await requireDb();
  const client = await getClientById(input.clientId);
  if (!client) throw new Error("Client not found.");

  const items = await database
    .select()
    .from(clientMediaItems)
    .where(and(
      eq(clientMediaItems.id, input.itemId),
      eq(clientMediaItems.clientId, input.clientId),
    ))
    .limit(1);
  const item = items[0];
  if (!item) throw new Error("Image not found.");

  const assignmentError = mediaLibraryAssignmentError(item, input.assetKind, input.slot);
  if (assignmentError) throw new Error(assignmentError);

  const asset: InsertClientAsset = {
    clientId: input.clientId,
    slot: input.slot as InsertClientAsset["slot"],
    mediaItemId: item.id,
    storageKey: item.storageKey,
    storageUrl: item.storageUrl,
    filename: item.filename,
    originalFilename: item.originalFilename,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    width: item.width,
    height: item.height,
  };

  await database.transaction(async transaction => {
    await transaction
      .insert(clientAssets)
      .values(asset)
      .onConflictDoUpdate({
        target: postgresConflictTargets.clientAssets,
        set: withUpdatedAt({
          mediaItemId: asset.mediaItemId,
          storageKey: asset.storageKey,
          storageUrl: asset.storageUrl,
          filename: asset.filename,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
        }),
      });
    await syncCategoryHeroImage(transaction, input.clientId, input.slot, item.storageUrl);
  });

  const listed = await listMediaLibrary(input.clientId);
  const next = listed.find(entry => entry.id === item.id);
  if (!next) throw new Error("Image not found.");
  return next;
}

export async function clearMediaSlot(input: {
  clientId: number;
  assetKind: MediaLibraryPlacementKind;
  slot: string;
}): Promise<void> {
  if (!isMediaLibraryPlacement(input.assetKind, input.slot)) {
    throw new Error("Choose a valid image placement.");
  }
  const database = await requireDb();
  await database.transaction(async transaction => {
    await transaction
      .delete(clientAssets)
      .where(and(
        eq(clientAssets.clientId, input.clientId),
        eq(clientAssets.slot, input.slot as InsertClientAsset["slot"]),
      ));
    await syncCategoryHeroImage(transaction, input.clientId, input.slot, "");
  });
}

async function syncCategoryHeroImage(
  transaction: Pick<AssetUploadDatabase, "select" | "update">,
  clientId: number,
  slot: string,
  heroImage: string,
): Promise<void> {
  const category = CATEGORY_BY_SLOT[slot];
  if (!category) return;
  const rows = await transaction
    .select()
    .from(astroClientConfigs)
    .where(eq(astroClientConfigs.clientId, clientId))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  const categories = {
    ...(row.categories ?? {}),
    [category]: {
      ...((row.categories?.[category] as Record<string, unknown> | undefined) ?? {}),
      heroImage,
    },
  };
  await transaction
    .update(astroClientConfigs)
    .set(withUpdatedAt({ categories }))
    .where(eq(astroClientConfigs.clientId, clientId));
}
