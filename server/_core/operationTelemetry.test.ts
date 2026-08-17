import { describe, expect, it, vi } from "vitest";
import { observeRuntimeOperation } from "./operationTelemetry";

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
});
