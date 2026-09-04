import { describe, expect, it } from "vitest";
import {
  defaultAltFromFilename,
  normalizeMediaItemMetadata,
  parseGalleryImages,
  resolveGalleryImages,
  serializeGalleryImages,
} from "./mediaLibrary";

describe("media library metadata", () => {
  it("turns a filename into readable default alt text", () => {
    expect(defaultAltFromFilename("showroom-floor_01.PNG")).toBe("showroom floor 01");
    expect(defaultAltFromFilename("")).toBe("");
  });

  it("trims and caps alt and description", () => {
    expect(normalizeMediaItemMetadata({
      alt: "  Hot tub  ",
      description: "  Installed in 2024.  ",
    })).toEqual({
      alt: "Hot tub",
      description: "Installed in 2024.",
    });
    expect(normalizeMediaItemMetadata({
      alt: "x".repeat(300),
      description: "y".repeat(2500),
    })).toEqual({
      alt: "x".repeat(240),
      description: "y".repeat(2000),
    });
  });
});

describe("gallery image field", () => {
  it("reads legacy newline URLs and keeps a shared fallback alt", () => {
    expect(parseGalleryImages("https://cdn.example/a.webp\n/brand/b.webp\nnot-a-url")).toEqual([
      { src: "https://cdn.example/a.webp", alt: "", description: "" },
      { src: "/brand/b.webp", alt: "", description: "" },
    ]);
  });

  it("round-trips structured gallery images with per-image copy", () => {
    const images = [
      { id: 12, src: "https://cdn.example/a.webp", alt: "Showroom", description: "Main floor" },
      { src: "https://cdn.example/b.webp", alt: "Delivery", description: "" },
    ];
    const encoded = serializeGalleryImages(images);
    expect(encoded.startsWith("[")).toBe(true);
    expect(parseGalleryImages(encoded)).toEqual(images);
  });

  it("uses live library copy when an item id is still present", () => {
    const field = serializeGalleryImages([
      { id: 12, src: "https://old.example/a.webp", alt: "Old", description: "Stale" },
      { src: "https://cdn.example/b.webp", alt: "Kept", description: "" },
    ]);
    expect(resolveGalleryImages(field, [
      { id: 12, storageUrl: "https://cdn.example/fresh.webp", alt: "Fresh alt", description: "Updated" },
    ], "Gallery")).toEqual([
      { src: "https://cdn.example/fresh.webp", alt: "Fresh alt" },
      { src: "https://cdn.example/b.webp", alt: "Kept" },
    ]);
  });

  it("falls back to the section heading when an image has no alt", () => {
    expect(resolveGalleryImages("https://cdn.example/a.webp", [], "Showroom photos")).toEqual([
      { src: "https://cdn.example/a.webp", alt: "Showroom photos" },
    ]);
  });
});
