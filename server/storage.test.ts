import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.example.test",
    forgeApiKey: "test-key",
  },
}));

import { storagePutExact } from "./storage";

describe("exact storage filenames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("adds a UUID suffix so concurrent uploads do not overwrite the same object", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://s3.example.test/upload" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await storagePutExact(
      "clients/7-paradise/hero.webp",
      Buffer.from("webp-bytes"),
      "image/webp",
    );

    const presignUrl = fetchMock.mock.calls[0]?.[0] as URL;
    const storedPath = presignUrl.searchParams.get("path") ?? "";
    expect(storedPath).toMatch(/^clients\/7-paradise\/hero_[a-f0-9]{32}\.webp$/);
    expect(result.key).toBe(storedPath);
    expect(result.url).toBe(`/manus-storage/${storedPath}`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://s3.example.test/upload");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
    });
  });

  it("aborts hung Forge requests instead of waiting forever", async () => {
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => AbortSignal.abort(new Error("storage timeout")));
    vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        return Promise.reject(init.signal.reason ?? new Error("aborted"));
      }
      return new Promise(() => undefined);
    });

    await expect(
      storagePutExact("clients/7-paradise/hero.webp", Buffer.from("webp-bytes"), "image/webp"),
    ).rejects.toBeTruthy();
  });
});
