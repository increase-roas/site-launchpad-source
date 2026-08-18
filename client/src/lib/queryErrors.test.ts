import { describe, expect, it } from "vitest";
import {
  clientSwitcherLabel,
  isServerQueryError,
  paidAdsWorkspaceErrorCopy,
  shouldRetryWorkspaceQuery,
} from "./queryErrors";

function trpcError(code: string, httpStatus: number, message: string) {
  return {
    message,
    data: { code, httpStatus },
    shape: { data: { code, httpStatus } },
  };
}

describe("workspace and funnel query error handling", () => {
  it("does not label a failed clients.list fetch as No clients yet", () => {
    expect(
      clientSwitcherLabel({
        clientCount: 0,
        isError: true,
      }),
    ).toBe("Couldn't load clients");
    expect(
      clientSwitcherLabel({
        clientCount: 0,
        isError: false,
      }),
    ).toBe("No clients yet");
  });

  it("stops retrying workspace.get on 5xx after one try", () => {
    const serverError = trpcError(
      "INTERNAL_SERVER_ERROR",
      500,
      "The database is temporarily unavailable. Please try again.",
    );
    const validation = trpcError("BAD_REQUEST", 400, "Invalid client.");

    expect(isServerQueryError(serverError)).toBe(true);
    expect(shouldRetryWorkspaceQuery(0, serverError)).toBe(false);
    expect(shouldRetryWorkspaceQuery(0, validation)).toBe(true);
    expect(shouldRetryWorkspaceQuery(1, validation)).toBe(false);
  });

  it("shows a Funnels error card instead of hanging on a server error", () => {
    const copy = paidAdsWorkspaceErrorCopy();
    expect(copy.title).toBe("Paid Ads funnels could not be loaded.");
    expect(copy.detail).toMatch(/try again/i);
  });
});
