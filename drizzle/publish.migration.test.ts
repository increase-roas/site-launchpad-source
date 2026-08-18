import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0004_dashboard_publishing.sql";

describe("dashboard publishing migration", () => {
  it("adds only the publish enums, job table, constraints, indexes, and RLS", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TYPE "public"."funnel_publish_step" AS ENUM');
    expect(sql).toContain(
      'CREATE TYPE "public"."funnel_publish_status" AS ENUM'
    );
    expect(sql).toContain('CREATE TABLE "funnelPublishes"');
    expect(sql).toContain('"funnelId" integer NOT NULL');
    expect(sql).toContain('"externalFunnelId" varchar(120) NOT NULL');
    expect(sql).toContain('"leaseToken" uuid');
    expect(sql).toContain('"leaseUntil" timestamp with time zone');
    expect(sql).toContain('"dispatchRequestedAt" timestamp with time zone');
    expect(sql).toContain('"workflowRunId" varchar(120)');
    expect(sql).toContain('"kvNamespaceId" varchar(120)');
    expect(sql).toContain('"d1DatabaseId" varchar(120)');
    expect(sql).toContain('"primaryQueueId" varchar(120)');
    expect(sql).toContain('"deadLetterQueueId" varchar(120)');
    expect(sql).toContain('"runtimeSecretsPatchedAt" timestamp with time zone');
    expect(sql).not.toContain("'locate_workflow'");
    expect(sql).toContain(
      'FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade'
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "funnel_publishes_funnel_unique"'
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "funnel_publishes_external_funnel_unique"'
    );
    expect(sql).toContain('CREATE INDEX "funnel_publishes_status_idx"');
    expect(sql).toContain('CREATE INDEX "funnel_publishes_lease_until_idx"');
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\bCREATE POLICY\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
  });
});
