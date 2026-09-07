import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("client media publications migration", () => {
  it("adds a publication table without dropping existing media", () => {
    const sql = readFileSync("drizzle/postgres/0018_client_media_publications.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "clientMediaPublications"');
    expect(sql).toContain('"destinationBucket" varchar(120)');
    expect(sql).toContain('"draftStorageKey" varchar(800)');
    expect(sql).toContain('"publishedUrl" varchar(1000)');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };

    expect(journal.entries.find(entry => entry.idx === 18)).toEqual(
      expect.objectContaining({
        idx: 18,
        tag: "0018_client_media_publications",
      }),
    );
    for (let index = 1; index < journal.entries.length; index += 1) {
      expect(journal.entries[index]!.when).toBeGreaterThan(
        journal.entries[index - 1]!.when,
      );
    }
  });
});
