export const RETRYABLE_DATABASE_PUBLIC_MESSAGE =
  "The database is temporarily unavailable. Please try again.";

export function isUnsafePublicErrorMessage(message: string): boolean {
  return (
    /Failed query/i.test(message) ||
    /params:/i.test(message) ||
    /postgresql:\/\//i.test(message) ||
    /relation ["'`]?.+["'`]? does not exist/i.test(message) ||
    /\binsert into\b/i.test(message)
  );
}

export function publicErrorMessage(
  message: string | undefined,
  fallback: string,
): string {
  if (!message || isUnsafePublicErrorMessage(message)) return fallback;
  return message;
}

export function isUndefinedRelationError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== "object" || visited.has(current)) {
      return false;
    }
    visited.add(current);
    const code =
      "code" in current ? String((current as { code: unknown }).code) : "";
    const message = current instanceof Error ? current.message : "";
    if (code === "42P01" || /relation ["'`]?.+["'`]? does not exist/i.test(message)) {
      return true;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}
