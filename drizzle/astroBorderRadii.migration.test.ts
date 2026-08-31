import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0013_drop_astro_border_radii.sql";

describe("astro border radii migration", () => {
  it("drops only the borderRadii column", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain('ALTER TABLE "astroClientConfigs" DROP COLUMN IF EXISTS "borderRadii"');
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bfonts\b/i);
    expect(sql).not.toMatch(/\bgeneratedConfigEncrypted\b/i);
  });
});
