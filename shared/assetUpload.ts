export const ASSET_KIND_VALUES = ["client", "astro"] as const;
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
