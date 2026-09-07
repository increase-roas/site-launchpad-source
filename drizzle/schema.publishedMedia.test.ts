import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { clientMediaPublications } from "./schema";

describe("client media publications schema", () => {
  it("records one public copy per draft key and website bucket", () => {
    const config = getTableConfig(clientMediaPublications);
    const names = config.columns.map(column => column.name);
    const indexNames = config.indexes.map(index => index.config.name);

    expect(names).toEqual(expect.arrayContaining([
      "clientId",
      "mediaItemId",
      "destinationBucket",
      "draftStorageKey",
      "publishedKey",
      "publishedUrl",
    ]));
    expect(indexNames).toEqual(expect.arrayContaining([
      "client_media_publications_destination_draft_unique",
      "client_media_publications_client_idx",
      "client_media_publications_media_item_idx",
    ]));
    expect(config.enableRLS).toBe(true);
  });
});
