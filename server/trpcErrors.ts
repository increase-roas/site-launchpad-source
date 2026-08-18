import { TRPCError } from "@trpc/server";
import { classifyRuntimeError } from "./_core/operationTelemetry";
import {
  RETRYABLE_DATABASE_PUBLIC_MESSAGE,
  publicErrorMessage,
} from "../shared/safePublicError";

function isRetryableDatabaseError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "RetryableDatabaseError",
  );
}

export function mapRouterError(error: unknown, fallback: string): TRPCError {
  if (error instanceof TRPCError) return error;
  const classification = classifyRuntimeError(error);
  if (
    isRetryableDatabaseError(error) ||
    classification === "database_connection" ||
    classification === "database_statement_timeout" ||
    classification === "timeout"
  ) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: RETRYABLE_DATABASE_PUBLIC_MESSAGE,
    });
  }
  const rawMessage = error instanceof Error ? error.message : fallback;
  const message = publicErrorMessage(rawMessage, fallback);
  if (/not found/i.test(message)) {
    return new TRPCError({ code: "NOT_FOUND", message });
  }
  return new TRPCError({ code: "BAD_REQUEST", message });
}

export class UpdateConflictError extends Error {
  constructor(message = "This client was updated elsewhere. Reload and try again.") {
    super(message);
    this.name = "UpdateConflictError";
  }
}

export function assertWritableVersion(
  currentUpdatedAt: Date | null | undefined,
  expectedUpdatedAt: Date,
): void {
  if (!currentUpdatedAt || currentUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new UpdateConflictError();
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
