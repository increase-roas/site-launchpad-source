import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "drizzle/postgres/0003_r2_direct_uploads.sql";

describe("R2 direct-upload migration", () => {
  it("adds only the upload-session enums, table, indexes, foreign key, and RLS", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TYPE "public"."asset_upload_kind" AS ENUM');
    expect(sql).toContain('CREATE TYPE "public"."asset_upload_status" AS ENUM');
    expect(sql).toContain('CREATE TABLE "assetUploadSessions"');
    expect(sql).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
    expect(sql).toContain('"clientId" integer NOT NULL');
    expect(sql).toContain('"tempKey" varchar(800) NOT NULL');
    expect(sql).toContain('CONSTRAINT "asset_upload_sessions_temp_key_unique" UNIQUE("tempKey")');
    expect(sql).toContain(
      'FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade',
    );
    expect(sql).toContain('CREATE INDEX "asset_upload_sessions_client_idx"');
    expect(sql).toContain('CREATE INDEX "asset_upload_sessions_status_idx"');
    expect(sql).toContain('CREATE INDEX "asset_upload_sessions_expires_at_idx"');
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(1);
    expect(sql).toContain(
      'ALTER TABLE "assetUploadSessions" ENABLE ROW LEVEL SECURITY;',
    );
    expect(sql).not.toMatch(/\bCREATE POLICY\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
  });
});
