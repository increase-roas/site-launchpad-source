import { describe, expect, it } from "vitest";
import {
  MAX_RAW_UPLOAD_BYTES,
  draftOriginalFilename,
  imageUploadRejectionMessage,
  photosAddedToLibraryToast,
} from "./assetUpload";

describe("imageUploadRejectionMessage", () => {
  it("rejects unsupported types instead of blaming file size", () => {
    expect(
      imageUploadRejectionMessage({ type: "image/gif", size: 1_024 }),
    ).toBe("Choose a JPEG, PNG, or WebP image.");
  });

  it("rejects empty files without calling them oversized", () => {
    expect(
      imageUploadRejectionMessage({ type: "image/png", size: 0 }),
    ).toBe("Choose an image file that is not empty.");
  });

  it("rejects files over 20 MB with a size message", () => {
    expect(
      imageUploadRejectionMessage({
        type: "image/jpeg",
        size: MAX_RAW_UPLOAD_BYTES + 1,
      }),
    ).toBe("Choose an image file smaller than 20 MB.");
  });

  it("accepts a supported image within the size limit", () => {
    expect(
      imageUploadRejectionMessage({ type: "image/webp", size: 12 }),
    ).toBeNull();
  });
});

describe("draftOriginalFilename", () => {
  it("keeps a normal file name and drops laptop paths", () => {
    expect(draftOriginalFilename("hero.png")).toBe("hero.png");
    expect(draftOriginalFilename("C:\\Users\\sky\\Downloads\\hero.png")).toBe("hero.png");
    expect(draftOriginalFilename("C:\\fakepath\\spa photo.png")).toBe("spa photo.png");
    expect(draftOriginalFilename("/Users/sky/Pictures/hero.png")).toBe("hero.png");
  });

  it("rejects empty or path-only values", () => {
    expect(draftOriginalFilename("   ")).toBe("");
    expect(draftOriginalFilename("C:\\Users\\sky\\")).toBe("");
  });
});

describe("photosAddedToLibraryToast", () => {
  it("does not claim photos were added when none uploaded", () => {
    expect(photosAddedToLibraryToast(0)).toBeNull();
  });

  it("uses singular copy for one uploaded photo", () => {
    expect(photosAddedToLibraryToast(1)).toBe("Photo added to the library.");
  });

  it("uses plural copy for the uploaded count, not the selected count", () => {
    expect(photosAddedToLibraryToast(2)).toBe("Photos added to the library.");
  });
});
