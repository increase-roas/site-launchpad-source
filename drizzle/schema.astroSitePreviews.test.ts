import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("Astro site preview job schema", () => {
  it("keeps a history of RLS-enabled preview jobs per client", () => {
    const config = getTableConfig(schema.astroSitePreviews);
    const columns = Object.fromEntries(
      config.columns.map(column => [column.name, column]),
    );
    const indexes = config.indexes.map(index => index.config.name);

    expect(columns.clientId?.notNull).toBe(true);
    expect(columns.clientRevision?.notNull).toBe(true);
    expect(columns.templateSha?.notNull).toBe(true);
    expect(columns.materialSnapshotEncrypted?.notNull).toBe(true);
    expect(columns.warnings?.notNull).toBe(true);
    expect(columns.previewUrl?.notNull).toBe(false);
    expect(columns.approvedSha?.notNull).toBe(false);
    expect(columns.leaseToken?.notNull).toBe(false);
    expect(indexes).toEqual(
      expect.arrayContaining([
        "astro_site_previews_client_idx",
        "astro_site_previews_status_idx",
        "astro_site_previews_lease_until_idx",
      ]),
    );
    expect(indexes).not.toContain("astro_site_previews_client_unique");
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });

  it("versions saved website configuration", () => {
    const config = getTableConfig(schema.astroClientConfigs);
    const columns = Object.fromEntries(
      config.columns.map(column => [column.name, column]),
    );
    expect(columns.websiteRevision?.notNull).toBe(true);
    expect(columns.serviceAreas?.notNull).toBe(true);
  });
});
