import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("astro service areas migration", () => {
  it("adds a text column without dropping existing config rows", () => {
    const sql = readFileSync("drizzle/postgres/0017_astro_service_areas.sql", "utf8");
    expect(sql).toContain('ALTER TABLE "astroClientConfigs" ADD COLUMN "serviceAreas"');
    expect(sql).toContain("DEFAULT ''");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };

    expect(journal.entries.find(entry => entry.idx === 17)).toEqual(
      expect.objectContaining({
        idx: 17,
        tag: "0017_astro_service_areas",
      }),
    );
    for (let index = 1; index < journal.entries.length; index += 1) {
      expect(journal.entries[index]!.when).toBeGreaterThan(
        journal.entries[index - 1]!.when,
      );
    }
  });
});
