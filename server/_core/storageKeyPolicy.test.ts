import { describe, expect, it } from "vitest";
import { isAllowedRedirectUrl, parseStorageKey, redirectHostsFromForgeUrl } from "./storageKeyPolicy";

describe("storage key policy", () => {
  it("accepts client object keys", () => {
    expect(parseStorageKey("clients/5-acme/hero.webp")).toEqual({
      clientId: 5,
      folder: "acme",
      rest: "hero.webp",
    });
    expect(parseStorageKey("clients/5-acme/astro/logo.webp").rest).toBe("astro/logo.webp");
  });

  it("rejects missing, traversal, and unmatched keys", () => {
    expect(() => parseStorageKey("")).toThrow("Invalid storage key");
    expect(() => parseStorageKey("clients/../secret")).toThrow("Invalid storage key");
    expect(() => parseStorageKey("other/5-acme/hero.webp")).toThrow("Invalid storage key");
  });

  it("allowlists https storage hosts only", () => {
    const hosts = redirectHostsFromForgeUrl("https://forge.example.test");
    expect(isAllowedRedirectUrl("https://bucket.s3.amazonaws.com/obj", hosts)).toBe(true);
    expect(isAllowedRedirectUrl("https://forge.example.test/obj", hosts)).toBe(true);
    expect(isAllowedRedirectUrl("https://evil.example/obj", hosts)).toBe(false);
    expect(isAllowedRedirectUrl("http://bucket.s3.amazonaws.com/obj", hosts)).toBe(false);
  });
});
