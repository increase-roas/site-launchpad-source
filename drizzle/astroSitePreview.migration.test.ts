import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Astro site preview migration", () => {
  it("adds versioned preview jobs without mutating production publishes", () => {
    const sql = readFileSync("drizzle/postgres/0015_astro_site_preview.sql", "utf8");
    expect(sql).toContain('ALTER TABLE "astroClientConfigs" ADD COLUMN "websiteRevision"');
    expect(sql).toContain('CREATE TABLE "astroSitePreviews"');
    expect(sql).toContain('"clientRevision" integer NOT NULL');
    expect(sql).toContain('"templateSha" varchar(120) NOT NULL');
    expect(sql).toContain('"materialSnapshotEncrypted" text NOT NULL');
    expect(sql).toContain('"previewUrl" varchar(1000)');
    expect(sql).toContain('"approvedSha" varchar(120)');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("astro_site_previews_active_client_unique");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
    expect(sql).not.toContain('ALTER TABLE "astroSitePublishes"');
    expect(sql).not.toMatch(/secretValue|accessToken|runtimeSecrets[^P]/i);
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries.find(entry => entry.idx === 15)).toEqual(
      expect.objectContaining({
        idx: 15,
        tag: "0015_astro_site_preview",
      }),
    );
  });
});
