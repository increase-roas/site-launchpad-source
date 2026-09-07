import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Astro site custom-domain migration", () => {
  it("only adds the attach step to the existing publish enum", () => {
    const sql = readFileSync(
      "drizzle/postgres/0019_astro_site_custom_domain.sql",
      "utf8",
    );
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'attach_custom_domain'");
    expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE/i);
  });
});
