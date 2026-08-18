import sharp from "sharp";
import type { AssetSlot } from "../shared/client";
import type { AstroAssetSlot } from "../shared/astroConfig";
import type { SupportedImageMimeType } from "../shared/assetUpload";

export const MAX_MARKETING_PHOTO_BYTES = 150 * 1024;
export const MARKETING_PHOTO_COMPRESS_ATTEMPTS = 5;

export async function inspectSupportedImageMimeType(
  source: Buffer,
): Promise<SupportedImageMimeType> {
  const metadata = await sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000,
    animated: false,
  }).metadata();

  switch (metadata.format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "tiff":
      return "image/tiff";
    case "gif":
      return "image/gif";
    case "heif":
      if (metadata.compression === "av1") return "image/avif";
      throw new Error("Unsupported HEIF image.");
    default:
      throw new Error("Unsupported image format.");
  }
}

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
};

async function describe(buffer: Buffer): Promise<Omit<ProcessedImage, "buffer" | "mimeType">> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("The image dimensions could not be read.");
  }
  return { byteSize: buffer.length, width: metadata.width, height: metadata.height };
}

async function renderWebp(source: Buffer, maxDimension: number, quality: number): Promise<Buffer> {
  return sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000,
    animated: false,
  })
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, alphaQuality: Math.max(quality, 70), effort: 4 })
    .toBuffer();
}

export async function processUploadedImage(
  source: Buffer,
  slot: AssetSlot,
): Promise<ProcessedImage> {
  if (slot === "logo") {
    const buffer = await renderWebp(source, 1200, 88);
    return { buffer, mimeType: "image/webp", ...(await describe(buffer)) };
  }

  let maxDimension = 2000;
  let quality = 82;

  for (let attempt = 0; attempt < MARKETING_PHOTO_COMPRESS_ATTEMPTS; attempt += 1) {
    const buffer = await renderWebp(source, maxDimension, quality);
    if (buffer.length < MAX_MARKETING_PHOTO_BYTES) {
      return { buffer, mimeType: "image/webp", ...(await describe(buffer)) };
    }

    if (quality > 42) {
      quality -= 8;
    } else {
      maxDimension = Math.max(480, Math.round(maxDimension * 0.8));
      quality = 70;
    }
  }

  const fallback = await renderWebp(source, 480, 28);
  if (fallback.length >= MAX_MARKETING_PHOTO_BYTES) {
    throw new Error("This photo could not be made small enough. Choose a simpler image.");
  }

  return { buffer: fallback, mimeType: "image/webp", ...(await describe(fallback)) };
}

export async function processAstroUploadedImage(
  source: Buffer,
  slot: AstroAssetSlot,
): Promise<ProcessedImage> {
  if (slot === "favicon") {
    const buffer = await renderWebp(source, 512, 90);
    return { buffer, mimeType: "image/webp", ...(await describe(buffer)) };
  }

  if (slot === "navLogo" || slot === "footerLogo" || slot === "inventoryLogo") {
    const buffer = await renderWebp(source, 1200, 90);
    return { buffer, mimeType: "image/webp", ...(await describe(buffer)) };
  }

  return processUploadedImage(source, "hero");
}
