import { beforeEach, describe, expect, it, vi } from "vitest";

const appMocks = vi.hoisted(() => ({
  createApp: vi.fn(),
}));

vi.mock("./app", () => ({
  createApp: appMocks.createApp,
}));

import handler from "./vercelApiHandler";

describe("Vercel app initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears a rejected initialization so a later invocation can recover", async () => {
    const initializationFailure = new Error("transient initialization failure");
    const app = vi.fn();
    appMocks.createApp
      .mockRejectedValueOnce(initializationFailure)
      .mockResolvedValueOnce(app);
    const request = {};
    const response = {};

    await expect(handler(request as never, response as never)).rejects.toBe(
      initializationFailure,
    );
    await expect(
      handler(request as never, response as never),
    ).resolves.toBeUndefined();

    expect(appMocks.createApp).toHaveBeenCalledTimes(2);
    expect(app).toHaveBeenCalledWith(request, response);
  });
});
