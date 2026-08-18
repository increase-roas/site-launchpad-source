import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("generic paid funnel publisher migration", () => {
  it("adds a separate durable publisher table without mutating old publish records", () => {
    const sql = readFileSync(
      "drizzle/postgres/0011_generic_paid_funnel_publish.sql",
      "utf8"
    );
    expect(sql).toContain('CREATE TABLE "generic_paid_funnel_publishes"');
    expect(sql).toContain(
      '"repositoryCreateRequestedAt" timestamp with time zone'
    );
    expect(sql).toContain('"dispatchRequestedAt" timestamp with time zone');
    expect(sql).toContain('"workflowRunId" varchar(120)');
    expect(sql).toContain('"leaseToken" uuid');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "generic_paid_funnel_publishes_funnel_unique"'
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
    expect(sql).not.toContain('ALTER TABLE "paid_funnel_publishes"');
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8")
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries.find(entry => entry.idx === 11)).toEqual(
      expect.objectContaining({
        idx: 11,
        tag: "0011_generic_paid_funnel_publish",
      })
    );
  });

  it("keeps every journal timestamp strictly increasing", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8")
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };

    for (let index = 1; index < journal.entries.length; index += 1) {
      expect(journal.entries[index]!.when).toBeGreaterThan(
        journal.entries[index - 1]!.when
      );
    }
  });

  it("adds an encrypted per-release material snapshot without plaintext columns", () => {
    const sql = readFileSync(
      "drizzle/postgres/0012_generic_paid_funnel_material_snapshot.sql",
      "utf8"
    );
    expect(sql).toContain('ADD COLUMN "materialSnapshotEncrypted" text');
    expect(sql).not.toMatch(/runtimeSecrets|secretValue|accessToken/i);
  });
});
