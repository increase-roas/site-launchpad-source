import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it, vi } from "vitest";
import {
  classifyRuntimeError,
  observeRuntimeOperation,
} from "./operationTelemetry";

describe("runtime operation telemetry", () => {
  it("logs timing and a safe classification without serializing error details", async () => {
    const unsafeDetail =
      "postgresql://private-user:private-password@private-host/database";
    const failure = Object.assign(new Error(unsafeDetail), {
      code: "CONNECT_TIMEOUT",
    });
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const timestamps = [100, 1_350];

    await expect(
      observeRuntimeOperation(
        "user_synchronization",
        async () => {
          throw failure;
        },
        {
          logger,
          now: () => timestamps.shift() ?? 1_350,
        },
      ),
    ).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith("[RuntimeOperation]", {
      operation: "user_synchronization",
      outcome: "failure",
      durationMs: 1_250,
      classification: "database_connection",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(unsafeDetail);
  });

  it("records successful operation timing without identity data", async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const timestamps = [50, 75];

    await expect(
      observeRuntimeOperation(
        "token_verification",
        async () => "verified",
        {
          logger,
          now: () => timestamps.shift() ?? 75,
        },
      ),
    ).resolves.toBe("verified");

    expect(logger.info).toHaveBeenCalledWith("[RuntimeOperation]", {
      operation: "token_verification",
      outcome: "success",
      durationMs: 25,
    });
  });

  it.each([
    "database_connection",
    "database_statement_timeout",
    "timeout",
  ] as const)(
    "preserves the safe retryable database classification %s",
    classification => {
      expect(
        classifyRuntimeError({
          code: "RETRYABLE_DATABASE_ERROR",
          classification,
        }),
      ).toBe(classification);
    },
  );

  it.each([
    ["CONNECTION_CLOSED", "database_connection"],
    ["CONNECTION_DESTROYED", "database_connection"],
    ["57014", "database_statement_timeout"],
  ] as const)(
    "classifies wrapped Drizzle cause %s as %s",
    (code, classification) => {
      const wrappedFailure = new DrizzleQueryError(
        "select fake_sensitive_column from fake_table",
        ["fake-sensitive-parameter"],
        Object.assign(new Error("driver failure"), { code }),
      );

      expect(classifyRuntimeError(wrappedFailure)).toBe(classification);
    },
  );

  it("keeps wrapped non-retryable errors unexpected", () => {
    const wrappedFailure = new DrizzleQueryError(
      "insert into fake_table values ($1)",
      ["duplicate-value"],
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    expect(classifyRuntimeError(wrappedFailure)).toBe("unexpected");
  });

  it("stops safely when the cause chain contains a cycle", () => {
    const cyclicFailure: Error & { cause?: unknown } = new Error(
      "cyclic failure",
    );
    cyclicFailure.cause = cyclicFailure;

    expect(classifyRuntimeError(cyclicFailure)).toBe("unexpected");
  });

  it("does not inspect an unbounded cause chain", () => {
    let nested: Error & { cause?: unknown } = Object.assign(
      new Error("deep connection failure"),
      { code: "CONNECTION_CLOSED" },
    );
    for (let index = 0; index < 1_000; index += 1) {
      nested = Object.assign(new Error(`wrapper-${index}`), {
        cause: nested,
      });
    }

    expect(classifyRuntimeError(nested)).toBe("unexpected");
  });
});
