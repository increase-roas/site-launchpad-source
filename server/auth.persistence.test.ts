import { describe, expect, it } from "vitest";
import { upsertUser } from "./db";

describe("authenticated-user persistence without a database", () => {
  it("fails closed instead of returning a user", async () => {
    const previousUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      await expect(
        upsertUser({
          authUserId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test",
          email: "test@example.com",
          loginMethod: "google",
          role: "user",
          lastSignedIn: new Date(),
        }),
      ).rejects.toThrow(/database/i);
    } finally {
      if (previousUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousUrl;
      }
    }
  });
});
