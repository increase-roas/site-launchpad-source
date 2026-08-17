export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class RequestTimeoutError extends Error {
  readonly code = "REQUEST_TIMEOUT";

  constructor(readonly timeoutMs: number) {
    super("The request exceeded its deadline.");
    this.name = "RequestTimeoutError";
  }
}

export async function fetchWithTimeout(
  fetchFn: FetchFunction,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const nativeTimeoutSignal = AbortSignal.timeout(timeoutMs);
  const deadlineController = new AbortController();
  const signals = [nativeTimeoutSignal, deadlineController.signal];
  if (init?.signal) {
    signals.push(init.signal);
  }
  const signal = AbortSignal.any(signals);
  const timeout = setTimeout(() => {
    deadlineController.abort(new RequestTimeoutError(timeoutMs));
  }, timeoutMs);
  let removeAbortListener: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const handleAbort = () => {
      if (nativeTimeoutSignal.aborted || deadlineController.signal.aborted) {
        reject(new RequestTimeoutError(timeoutMs));
        return;
      }
      reject(
        init?.signal?.reason ??
          new DOMException("The request was aborted.", "AbortError"),
      );
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", handleAbort);
  });

  try {
    return await Promise.race([
      fetchFn(input, {
        ...(init ?? {}),
        signal,
      }),
      aborted,
    ]);
  } finally {
    clearTimeout(timeout);
    removeAbortListener();
  }
}
