import { describe, expect, it } from "vitest";
import {
  isMediaLibraryPlacement,
  mediaLibraryAssignmentError,
  toMediaLibraryItemDto,
} from "./mediaLibrary";

const landscape = {
  id: 12,
  storageKey: "clients/7/library/showroom.webp",
  storageUrl: "https://cdn.example/showroom.webp",
  filename: "showroom.webp",
  originalFilename: "showroom.jpg",
  mimeType: "image/webp",
  byteSize: 180_000,
  width: 1600,
  height: 900,
  alt: "Showroom",
  description: "Main floor",
  createdAt: new Date("2026-09-04T12:00:00.000Z"),
};

describe("media library placements", () => {
  it("accepts a landscape library photo for a hero slot", () => {
    expect(isMediaLibraryPlacement("astro", "categoryHotTubs")).toBe(true);
    expect(mediaLibraryAssignmentError(landscape, "astro", "categoryHotTubs")).toBeNull();
  });

  it("rejects assigning a wide photo to the favicon", () => {
    expect(mediaLibraryAssignmentError(landscape, "astro", "favicon")).toMatch(/1:1/);
  });

  it("groups assigned slots onto the library item", () => {
    expect(toMediaLibraryItemDto(landscape, ["ogImage", "hero"]).slots).toEqual([
      "ogImage",
      "hero",
    ]);
  });
});
