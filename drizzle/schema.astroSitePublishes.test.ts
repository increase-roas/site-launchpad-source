import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("Astro site publish job schema", () => {
  it("enforces one leased RLS-enabled job per client", () => {
    const config = getTableConfig(schema.astroSitePublishes);
    const columns = Object.fromEntries(
      config.columns.map(column => [column.name, column]),
    );
    const indexes = config.indexes.map(index => index.config.name);

    expect(columns.clientId?.notNull).toBe(true);
    expect(columns.externalSiteId?.notNull).toBe(true);
    expect(columns.d1DatabaseName?.notNull).toBe(true);
    expect(columns.r2BucketName?.notNull).toBe(true);
    expect(columns.leaseToken?.notNull).toBe(false);
    expect(columns.dispatchRequestedAt?.notNull).toBe(false);
    expect(indexes).toEqual(
      expect.arrayContaining([
        "astro_site_publishes_client_unique",
        "astro_site_publishes_external_site_unique",
        "astro_site_publishes_status_idx",
        "astro_site_publishes_lease_until_idx",
      ]),
    );
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});
