import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0009_client_integration_profile.sql";

describe("client integration profile migration", () => {
  it("adds only the client_integration_profiles table, index, and RLS", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain('CREATE TABLE "client_integration_profiles"');
    expect(sql).toContain('"secretsEncrypted" text');
    expect(sql).toContain('"reconciliationStatus"');
    expect(sql).toContain('"conflictedKeys" jsonb NOT NULL');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/\bCREATE POLICY\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toContain("GHL_API_KEY");
    expect(sql).not.toContain("password");
  });
});
