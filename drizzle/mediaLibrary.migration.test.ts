import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("client media library migration", () => {
  it("adds a reusable library without dropping existing slot files", () => {
    const sql = readFileSync("drizzle/postgres/0016_client_media_library.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "clientMediaItems"');
    expect(sql).toContain('"alt" varchar(240)');
    expect(sql).toContain('"description" varchar(2000)');
    expect(sql).toContain('INSERT INTO "clientMediaItems"');
    expect(sql).toContain('ALTER TABLE "clientAssets" ADD COLUMN "mediaItemId"');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ADD VALUE 'library'");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };

    expect(journal.entries.find(entry => entry.idx === 16)).toEqual(
      expect.objectContaining({
        idx: 16,
        tag: "0016_client_media_library",
      }),
    );
    for (let index = 1; index < journal.entries.length; index += 1) {
      expect(journal.entries[index]!.when).toBeGreaterThan(
        journal.entries[index - 1]!.when,
      );
    }
  });
});
