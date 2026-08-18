import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("generic paid funnel publisher migration", () => {
  it("adds a separate durable publisher table without mutating old publish records", () => {
    const sql = readFileSync(
      "drizzle/postgres/0011_generic_paid_funnel_publish.sql",
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE "generic_paid_funnel_publishes"');
    expect(sql).toContain('"repositoryCreateRequestedAt" timestamp with time zone');
    expect(sql).toContain('"dispatchRequestedAt" timestamp with time zone');
    expect(sql).toContain('"workflowRunId" varchar(120)');
    expect(sql).toContain('"leaseToken" uuid');
    expect(sql).toContain('CREATE UNIQUE INDEX "generic_paid_funnel_publishes_funnel_unique"');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
    expect(sql).not.toContain('ALTER TABLE "paid_funnel_publishes"');
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/postgres/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries.at(-1)).toEqual(
      expect.objectContaining({
        idx: 11,
        tag: "0011_generic_paid_funnel_publish",
      }),
    );
  });
});
