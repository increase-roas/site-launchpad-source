import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MAX_MARKETING_PHOTO_BYTES,
  processAstroUploadedImage,
  processUploadedImage,
} from "./imageProcessing";

describe("server-side image preparation", () => {
  it("converts a marketing photo to WebP below 150 KB", async () => {
    const source = await sharp({
      create: {
        width: 2600,
        height: 1800,
        channels: 3,
        background: { r: 29, g: 116, b: 132 },
      },
    })
      .png()
      .toBuffer();

    const result = await processUploadedImage(source, "hero");
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(result.byteSize).toBeLessThan(MAX_MARKETING_PHOTO_BYTES);
    expect(result.width).toBeLessThanOrEqual(2000);
    expect(result.height).toBeLessThanOrEqual(2000);
  });

  it("converts a logo to a thumbnail-ready WebP", async () => {
    const source = await sharp({
      create: {
        width: 1800,
        height: 900,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await processUploadedImage(source, "logo");
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.format).toBe("webp");
    expect(result.width).toBeLessThanOrEqual(1200);
    expect(result.height).toBeLessThanOrEqual(1200);
  });

  it("prepares Astro logos and favicons as bounded WebP assets", async () => {
    const source = await sharp({
      create: {
        width: 1800,
        height: 1800,
        channels: 4,
        background: { r: 8, g: 145, b: 178, alpha: 1 },
      },
    }).png().toBuffer();

    const logo = await processAstroUploadedImage(source, "navLogo");
    const favicon = await processAstroUploadedImage(source, "favicon");
    expect((await sharp(logo.buffer).metadata()).format).toBe("webp");
    expect((await sharp(favicon.buffer).metadata()).format).toBe("webp");
    expect(logo.width).toBeLessThanOrEqual(1200);
    expect(favicon.width).toBeLessThanOrEqual(512);
  });

  it("compresses Open Graph and category hero assets below 150 KB", async () => {
    const source = await sharp({
      create: {
        width: 2600,
        height: 1600,
        channels: 3,
        background: { r: 91, g: 115, b: 63 },
      },
    }).png().toBuffer();

    for (const slot of ["ogImage", "categoryHotTubs"] as const) {
      const result = await processAstroUploadedImage(source, slot);
      expect(result.mimeType).toBe("image/webp");
      expect(result.byteSize).toBeLessThan(MAX_MARKETING_PHOTO_BYTES);
    }
  });
});
