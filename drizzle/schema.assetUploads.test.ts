import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { assetUploadSessions } from "./schema";

describe("asset upload session schema", () => {
  it("uses a generated UUID identity, client cascade, safe indexes, and RLS", () => {
    const config = getTableConfig(assetUploadSessions);
    const id = config.columns.find(column => column.name === "id");
    const clientId = config.columns.find(column => column.name === "clientId");
    const tempKey = config.columns.find(column => column.name === "tempKey");
    const indexNames = config.indexes.map(index => index.config.name);

    expect(id?.dataType).toBe("string");
    expect(id?.primary).toBe(true);
    expect(id?.hasDefault).toBe(true);
    expect(clientId?.notNull).toBe(true);
    expect(tempKey?.notNull).toBe(true);
    expect(tempKey?.isUnique).toBe(true);
    expect(tempKey?.uniqueName).toBe("asset_upload_sessions_temp_key_unique");
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "asset_upload_sessions_client_idx",
        "asset_upload_sessions_status_idx",
        "asset_upload_sessions_expires_at_idx",
      ]),
    );
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});
