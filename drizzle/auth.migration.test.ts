import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  import.meta.dirname,
  "postgres/0002_supabase_auth.sql",
);

describe("Supabase auth identity migration", () => {
  it("replaces the Manus identifier with a unique non-null UUID", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map(statement => statement.trim())
      .filter(Boolean);

    expect(statements).toEqual([
      'ALTER TABLE "users" DROP CONSTRAINT "users_openId_unique";',
      'ALTER TABLE "users" ADD COLUMN "authUserId" uuid NOT NULL;',
      'ALTER TABLE "users" DROP COLUMN "openId";',
      'ALTER TABLE "users" ADD CONSTRAINT "users_authUserId_unique" UNIQUE("authUserId");',
    ]);
  });
});
