import { describe, expect, it } from "vitest";
import { MEDIA_SPECIFICATIONS, validateImageMetadata } from "./mediaSpecifications";

describe("media specifications", () => {
  it("accepts a correctly sized hero image", () => {
    expect(validateImageMetadata({
      mimeType: "image/webp",
      sizeBytes: 1_500_000,
      width: 1600,
      height: 900,
    }, MEDIA_SPECIFICATIONS.hero)).toBeNull();
  });

  it("rejects unsupported formats, oversized files, small images, and wrong ratios", () => {
    expect(validateImageMetadata({ mimeType: "image/gif", sizeBytes: 10, width: 1600, height: 900 }, MEDIA_SPECIFICATIONS.hero)).toMatch(/format/);
    expect(validateImageMetadata({ mimeType: "image/png", sizeBytes: 3_000_000, width: 1600, height: 900 }, MEDIA_SPECIFICATIONS.hero)).toMatch(/under 2 MB/);
    expect(validateImageMetadata({ mimeType: "image/png", sizeBytes: 10, width: 800, height: 450 }, MEDIA_SPECIFICATIONS.hero)).toMatch(/at least/);
    expect(validateImageMetadata({ mimeType: "image/png", sizeBytes: 10, width: 1600, height: 1200 }, MEDIA_SPECIFICATIONS.hero)).toMatch(/16:9/);
  });
});
