import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { clientAssets, clientMediaItems } from "./schema";

describe("client media library schema", () => {
  it("stores reusable photos with alt, description, and RLS", () => {
    const config = getTableConfig(clientMediaItems);
    const names = config.columns.map(column => column.name);
    const indexNames = config.indexes.map(index => index.config.name);

    expect(names).toEqual(expect.arrayContaining([
      "id",
      "clientId",
      "storageKey",
      "storageUrl",
      "alt",
      "description",
    ]));
    expect(indexNames).toEqual(expect.arrayContaining([
      "client_media_items_storage_key_unique",
      "client_media_items_client_idx",
    ]));
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });

  it("lets a placement point at a library item without owning the file", () => {
    const config = getTableConfig(clientAssets);
    const mediaItemId = config.columns.find(column => column.name === "mediaItemId");
    const indexNames = config.indexes.map(index => index.config.name);
    const mediaFk = config.foreignKeys.find(foreignKey =>
      foreignKey.reference().columns.some(column => column.name === "mediaItemId"),
    );

    expect(mediaItemId?.notNull).toBe(false);
    expect(mediaFk?.onDelete).toBe("set null");
    expect(indexNames).toContain("client_assets_media_item_idx");
  });
});
