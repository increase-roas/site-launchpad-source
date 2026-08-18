type ErrorData = {
  code?: unknown;
  httpStatus?: unknown;
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function readErrorData(error: unknown): ErrorData | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("data" in error && (error as { data?: unknown }).data && typeof (error as { data?: unknown }).data === "object") {
    return (error as { data: ErrorData }).data;
  }
  if (
    "shape" in error &&
    (error as { shape?: { data?: unknown } }).shape &&
    typeof (error as { shape?: { data?: unknown } }).shape === "object" &&
    (error as { shape: { data?: unknown } }).shape.data &&
    typeof (error as { shape: { data?: unknown } }).shape.data === "object"
  ) {
    return (error as { shape: { data: ErrorData } }).shape.data;
  }
  return undefined;
}

export function getTrpcErrorCode(error: unknown): string | undefined {
  const code = readErrorData(error)?.code;
  return typeof code === "string" ? code : undefined;
}

export function getTrpcHttpStatus(error: unknown): number | undefined {
  const status = readErrorData(error)?.httpStatus;
  return typeof status === "number" ? status : undefined;
}

export function isServerQueryError(error: unknown): boolean {
  if (!error) return false;
  const code = getTrpcErrorCode(error);
  const status = getTrpcHttpStatus(error);
  const message = readErrorMessage(error);
  return (
    code === "INTERNAL_SERVER_ERROR" ||
    (typeof status === "number" && status >= 500) ||
    /temporarily unavailable/i.test(message)
  );
}

export function shouldRetryWorkspaceQuery(failureCount: number, error: unknown): boolean {
  if (isServerQueryError(error)) return false;
  return failureCount < 1;
}

export function clientSwitcherLabel(input: {
  selectedName?: string;
  clientCount: number;
  isError: boolean;
}): string {
  if (input.selectedName) return input.selectedName;
  if (input.isError) return "Couldn't load clients";
  return input.clientCount > 0 ? "Choose client" : "No clients yet";
}

export function paidAdsWorkspaceErrorCopy(): {
  title: string;
  detail: string;
} {
  return {
    title: "Paid Ads funnels could not be loaded.",
    detail: "Try again. If this keeps happening, ask Alex for help.",
  };
}
