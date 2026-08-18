export type RuntimeOperation =
  | "token_verification"
  | "user_synchronization"
  | "clients_list_database";

type RuntimeLogger = Pick<Console, "error" | "info">;

type RuntimeTelemetryOptions = {
  logger?: RuntimeLogger;
  now?: () => number;
};

export type RuntimeErrorClassification =
  | "aborted"
  | "database_connection"
  | "database_statement_timeout"
  | "timeout"
  | "unexpected";

const MAX_ERROR_CAUSE_DEPTH = 8;

function errorProperty(
  error: unknown,
  property: "classification" | "code" | "name",
): string {
  if (!error || typeof error !== "object" || !(property in error)) {
    return "";
  }
  const value = (
    error as Record<"classification" | "code" | "name", unknown>
  )[property];
  return typeof value === "string" ? value : "";
}

function errorCause(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return undefined;
  }
  return (error as { cause?: unknown }).cause;
}

function classifySingleRuntimeError(
  error: unknown,
): RuntimeErrorClassification {
  const preservedClassification = errorProperty(error, "classification");
  const code = errorProperty(error, "code");
  const name = errorProperty(error, "name");

  if (
    preservedClassification === "database_connection" ||
    preservedClassification === "database_statement_timeout" ||
    preservedClassification === "timeout"
  ) {
    return preservedClassification;
  }
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

export function classifyRuntimeError(
  error: unknown,
): RuntimeErrorClassification {
  const visited = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth < MAX_ERROR_CAUSE_DEPTH; depth += 1) {
    if (!current || typeof current !== "object" || visited.has(current)) {
      return "unexpected";
    }
    visited.add(current);

    const classification = classifySingleRuntimeError(current);
    if (classification !== "unexpected") {
      return classification;
    }

    current = errorCause(current);
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
