import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0008_paid_funnel_registry.sql";

describe("paid funnel registry migration", () => {
  it("adds only the paid-funnel registry tables, indexes, and RLS", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TABLE "paid_funnel_templates"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_template_versions"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_template_artifacts"');
    expect(sql).toContain('CREATE TABLE "paid_funnels"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_steps"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_graphs"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_graph_revisions"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_reusable_sections"');
    expect(sql).toContain('CREATE TABLE "paid_funnel_publishes"');
    expect(sql).toContain('"packageJson" jsonb NOT NULL');
    expect(sql).toContain('"unsupportedErrors" jsonb NOT NULL');
    expect(sql).toContain('"storageKey" varchar(800) NOT NULL');
    expect(sql).toContain('CREATE TYPE "public"."paid_funnel_publish_adapter"');
    expect(sql).toContain("'generic-paid-funnel'");
    expect(sql).toContain("'legacy-simple-form'");
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(9);
    expect(sql).not.toMatch(/\bCREATE POLICY\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bDROP TYPE\b/i);
  });
});
