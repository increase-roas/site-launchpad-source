export const ASSET_KIND_VALUES = ["client", "astro", "library"] as const;
export type AssetKind = (typeof ASSET_KIND_VALUES)[number];

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export const MAX_RAW_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isSupportedImageMimeType(value: string): value is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function imageUploadRejectionMessage(file: {
  type: string;
  size: number;
}): string | null {
  if (!isSupportedImageMimeType(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size <= 0) {
    return "Choose an image file that is not empty.";
  }
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    return "Choose an image file smaller than 20 MB.";
  }
  return null;
}

export function photosAddedToLibraryToast(uploadedCount: number): string | null {
  if (uploadedCount <= 0) return null;
  return uploadedCount === 1
    ? "Photo added to the library."
    : "Photos added to the library.";
}
