export type RuntimeOperation =
  | "token_verification"
  | "user_synchronization"
  | "clients_list_database";

type RuntimeLogger = Pick<Console, "error" | "info">;

type RuntimeTelemetryOptions = {
  logger?: RuntimeLogger;
  now?: () => number;
};

type RuntimeErrorClassification =
  | "aborted"
  | "database_connection"
  | "database_statement_timeout"
  | "timeout"
  | "unexpected";

function errorProperty(error: unknown, property: "code" | "name"): string {
  if (!error || typeof error !== "object" || !(property in error)) {
    return "";
  }
  const value = (error as Record<"code" | "name", unknown>)[property];
  return typeof value === "string" ? value : "";
}

export function classifyRuntimeError(
  error: unknown,
): RuntimeErrorClassification {
  const code = errorProperty(error, "code");
  const name = errorProperty(error, "name");

  if (
    code === "DATABASE_OPERATION_TIMEOUT" ||
    code === "REQUEST_TIMEOUT" ||
    name === "DatabaseOperationTimeoutError" ||
    name === "TimeoutError"
  ) {
    return "timeout";
  }
  if (
    code === "CONNECT_TIMEOUT" ||
    code === "CONNECTION_CLOSED" ||
    code === "CONNECTION_DESTROYED" ||
    code === "CONNECTION_ENDED"
  ) {
    return "database_connection";
  }
  if (code === "57014") {
    return "database_statement_timeout";
  }
  if (name === "AbortError") {
    return "aborted";
  }
  return "unexpected";
}

export async function observeRuntimeOperation<T>(
  operation: RuntimeOperation,
  run: () => Promise<T>,
  options: RuntimeTelemetryOptions = {},
): Promise<T> {
  const logger = options.logger ?? console;
  const now = options.now ?? (() => performance.now());
  const startedAt = now();

  try {
    const result = await run();
    logger.info("[RuntimeOperation]", {
      operation,
      outcome: "success",
      durationMs: Math.round(now() - startedAt),
    });
    return result;
  } catch (error) {
    logger.error("[RuntimeOperation]", {
      operation,
      outcome: "failure",
      durationMs: Math.round(now() - startedAt),
      classification: classifyRuntimeError(error),
    });
    throw error;
  }
}
