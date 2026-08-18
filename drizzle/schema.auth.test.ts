import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { users } from "./schema";

describe("Supabase user identity schema", () => {
  it("stores a unique non-null UUID authUserId and removes openId", () => {
    const config = getTableConfig(users);
    const authUserId = config.columns.find(
      column => column.name === "authUserId",
    );

    expect(config.columns.map(column => column.name)).not.toContain("openId");
    expect(authUserId).toBeDefined();
    expect(authUserId?.getSQLType()).toBe("uuid");
    expect(authUserId?.notNull).toBe(true);
    expect(authUserId?.isUnique).toBe(true);
  });
});
