import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertWritableVersion, isDuplicateKeyError, mapRouterError, UpdateConflictError } from "./trpcErrors";

describe("router error mapping", () => {
  it("preserves an existing TRPCError code", () => {
    const original = new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
    expect(mapRouterError(original, "fallback")).toBe(original);
  });

  it("maps not-found messages to NOT_FOUND", () => {
    const mapped = mapRouterError(new Error("Client not found."), "fallback");
    expect(mapped).toMatchObject({ code: "NOT_FOUND", message: "Client not found." });
  });

  it("maps other errors to BAD_REQUEST", () => {
    const mapped = mapRouterError(new Error("Invalid slug."), "fallback");
    expect(mapped).toMatchObject({ code: "BAD_REQUEST", message: "Invalid slug." });
  });
});

describe("optimistic client writes", () => {
  it("accepts a matching updatedAt", () => {
    const stamp = new Date("2026-08-13T12:00:00.000Z");
    expect(() => assertWritableVersion(stamp, stamp)).not.toThrow();
  });

  it("rejects a stale updatedAt", () => {
    expect(() =>
      assertWritableVersion(new Date("2026-08-13T12:00:00.000Z"), new Date("2026-08-13T11:00:00.000Z")),
    ).toThrow(UpdateConflictError);
  });
});

describe("duplicate key detection", () => {
  it("recognizes MySQL duplicate entry errors", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateKeyError(new Error("other"))).toBe(false);
  });
});
