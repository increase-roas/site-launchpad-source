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

  it("maps retryable database failures to INTERNAL_SERVER_ERROR without changing the public message", () => {
    const retryable = Object.assign(
      new Error("The database is temporarily unavailable. Please try again."),
      { name: "RetryableDatabaseError", code: "RETRYABLE_DATABASE_ERROR" },
    );
    expect(mapRouterError(retryable, "fallback")).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "The database is temporarily unavailable. Please try again.",
    });
  });

  it("maps nested connection failures to the public retryable message without SQL", () => {
    const wrapped = Object.assign(
      new Error(
        'Failed query: insert into paid_funnels ("clientId") values ($1)\\nparams: 7',
      ),
      {
        cause: Object.assign(new Error("write CONNECTION_CLOSED"), {
          code: "CONNECTION_CLOSED",
        }),
      },
    );
    const mapped = mapRouterError(
      wrapped,
      "Paid funnel could not be created from the template.",
    );
    expect(mapped).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "The database is temporarily unavailable. Please try again.",
    });
    expect(mapped.message).not.toMatch(/Failed query|paid_funnels|params:/);
  });

  it("replaces leaked SQL on missing client_integration_profiles with the fallback", () => {
    const leaked = new Error(
      'Failed query: select \"clientId\" from client_integration_profiles',
    );
    const mapped = mapRouterError(leaked, "Integrations could not be loaded.");
    expect(mapped).toMatchObject({
      code: "BAD_REQUEST",
      message: "Integrations could not be loaded.",
    });
    expect(mapped.message).not.toContain("client_integration_profiles");
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
  it("recognizes only PostgreSQL unique-violation SQLSTATE errors", () => {
    expect(isDuplicateKeyError({ code: "23505" })).toBe(true);
    expect(isDuplicateKeyError(new Error("duplicate key value violates unique constraint"))).toBe(
      false,
    );
    expect(isDuplicateKeyError({ code: "23503" })).toBe(false);
    expect(isDuplicateKeyError(new Error("other"))).toBe(false);
  });
});
