import { describe, expect, it } from "vitest";
import {
  isUndefinedRelationError,
  isUnsafePublicErrorMessage,
  publicErrorMessage,
} from "./safePublicError";

describe("safe public error messages", () => {
  it("hides leaked SQL and connection strings", () => {
    expect(
      isUnsafePublicErrorMessage(
        'Failed query: select "clientId" from client_integration_profiles',
      ),
    ).toBe(true);
    expect(
      publicErrorMessage(
        'Failed query: select "clientId" from client_integration_profiles',
        "Integrations could not be loaded.",
      ),
    ).toBe("Integrations could not be loaded.");
  });

  it("detects a missing-table cause under a wrapper", () => {
    const wrapped = Object.assign(new Error("Failed query: select 1"), {
      cause: Object.assign(new Error('relation "client_integration_profiles" does not exist'), {
        code: "42P01",
      }),
    });
    expect(isUndefinedRelationError(wrapped)).toBe(true);
  });
});
