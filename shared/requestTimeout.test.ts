import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./requestTimeout";

describe("bounded fetch transport", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a fetch that never resolves at the configured deadline", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | null | undefined;
    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        observedSignal = init?.signal;
        return new Promise<Response>(() => undefined);
      },
    );
    const completion = vi.fn();
    void fetchWithTimeout(
      fetchFn,
      "/api/trpc/clients.list",
      { credentials: "same-origin" },
      45_000,
    ).then(
      () => completion("resolved"),
      error => completion(error),
    );

    await vi.advanceTimersByTimeAsync(45_000);

    expect(observedSignal?.aborted).toBe(true);
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "RequestTimeoutError",
      }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/trpc/clients.list",
      expect.objectContaining({
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
