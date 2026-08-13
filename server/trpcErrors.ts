import { TRPCError } from "@trpc/server";

export function mapRouterError(error: unknown, fallback: string): TRPCError {
  if (error instanceof TRPCError) return error;
  const message = error instanceof Error ? error.message : fallback;
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
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ER_DUP_ENTRY",
  );
}
