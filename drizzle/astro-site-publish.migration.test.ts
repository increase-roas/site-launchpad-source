import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Astro site publishing migration", () => {
  it("adds only the dedicated enums, job table, indexes, foreign key, and RLS", () => {
    const sql = readFileSync(
      "drizzle/postgres/0007_sloppy_lethal_legion.sql",
      "utf8",
    );
    expect(sql).toContain('CREATE TYPE "public"."astro_site_publish_step"');
    expect(sql).toContain('CREATE TYPE "public"."astro_site_publish_status"');
    expect(sql).toContain('CREATE TABLE "astroSitePublishes"');
    expect(sql).toContain('"clientId" integer NOT NULL');
    expect(sql).toContain('"d1DatabaseName" varchar(120) NOT NULL');
    expect(sql).toContain('"r2BucketName" varchar(120) NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "astro_site_publishes_client_unique"');
    expect(sql).toContain('CREATE UNIQUE INDEX "astro_site_publishes_external_site_unique"');
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bCREATE POLICY\b/i);
  });
});
