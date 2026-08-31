import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0014_drop_workspace_page_tables.sql";

describe("workspace page tables migration", () => {
  it("drops the duplicate page and homepage section stores", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain('DROP TABLE IF EXISTS "homepageSections"');
    expect(sql).toContain('DROP TABLE IF EXISTS "sitePages"');
    expect(sql).toContain('DROP TYPE IF EXISTS "public"."homepage_section_type"');
    expect(sql).toContain('DROP TYPE IF EXISTS "public"."site_page_type"');
  });

  it("leaves the shared status enum and funnel tables alone", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/workspace_status/i);
    expect(sql).not.toMatch(/\bfunnels?\b/i);
    expect(sql).not.toMatch(/astroClientConfigs/i);
  });
});
