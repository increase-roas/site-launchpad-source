import { and, desc, eq } from "drizzle-orm";
import { clientMediaPublications } from "../drizzle/schema";
import type { MediaPublication } from "../shared/publishedMedia";
import { getDb } from "./db";
import { withUpdatedAt } from "./postgresPersistence";

async function requireDb() {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable.");
  return database;
}

function toPublication(row: typeof clientMediaPublications.$inferSelect): MediaPublication {
  return {
    mediaItemId: row.mediaItemId,
    draftStorageKey: row.draftStorageKey,
    publishedKey: row.publishedKey,
    publishedUrl: row.publishedUrl,
    destinationBucket: row.destinationBucket,
  };
}

export async function findLatestMediaPublicationByDraftKey(
  draftStorageKey: string,
): Promise<MediaPublication | null> {
  const database = await requireDb();
  const rows = await database
    .select()
    .from(clientMediaPublications)
    .where(eq(clientMediaPublications.draftStorageKey, draftStorageKey))
    .orderBy(desc(clientMediaPublications.updatedAt))
    .limit(1);
  return rows[0] ? toPublication(rows[0]) : null;
}

export async function listMediaPublications(
  clientId: number,
  destinationBucket: string,
): Promise<MediaPublication[]> {
  const database = await requireDb();
  const rows = await database
    .select()
    .from(clientMediaPublications)
    .where(and(
      eq(clientMediaPublications.clientId, clientId),
      eq(clientMediaPublications.destinationBucket, destinationBucket),
    ));
  return rows.map(toPublication);
}

export async function saveMediaPublication(
  clientId: number,
  publication: MediaPublication,
): Promise<MediaPublication> {
  const database = await requireDb();
  const values = {
    clientId,
    mediaItemId: publication.mediaItemId,
    destinationBucket: publication.destinationBucket,
    draftStorageKey: publication.draftStorageKey,
    publishedKey: publication.publishedKey,
    publishedUrl: publication.publishedUrl,
  };
  const inserted = await database
    .insert(clientMediaPublications)
    .values(values)
    .onConflictDoUpdate({
      target: [
        clientMediaPublications.clientId,
        clientMediaPublications.destinationBucket,
        clientMediaPublications.draftStorageKey,
      ],
      set: withUpdatedAt({
        mediaItemId: publication.mediaItemId,
        publishedKey: publication.publishedKey,
        publishedUrl: publication.publishedUrl,
      }),
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("The published image record could not be saved.");
  return toPublication(row);
}

export async function removeMediaPublication(
  clientId: number,
  publication: MediaPublication,
): Promise<void> {
  const database = await requireDb();
  await database
    .delete(clientMediaPublications)
    .where(and(
      eq(clientMediaPublications.clientId, clientId),
      eq(clientMediaPublications.destinationBucket, publication.destinationBucket),
      eq(clientMediaPublications.draftStorageKey, publication.draftStorageKey),
    ));
}
