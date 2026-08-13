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
  });

  it("preserves the deterministic template path instead of adding a suffix", async () => {
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
    expect(presignUrl.searchParams.get("path")).toBe("clients/7-paradise/hero.webp");
    expect(result).toEqual({
      key: "clients/7-paradise/hero.webp",
      url: "/manus-storage/clients/7-paradise/hero.webp",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://s3.example.test/upload");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
    });
  });
});
