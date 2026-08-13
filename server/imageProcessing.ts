import sharp from "sharp";
import type { AssetSlot } from "../shared/client";
import type { AstroAssetSlot } from "../shared/astroConfig";

export const MAX_MARKETING_PHOTO_BYTES = 150 * 1024;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/gif",
]);

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
};

export function decodeImageDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error("Choose an image file and try again.");

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Use a JPG, PNG, WebP, AVIF, TIFF, or GIF image.");
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) throw new Error("That image appears to be empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("That image is too large. Choose one smaller than 20 MB.");
  }

  return { buffer, mimeType };
}

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

  for (let attempt = 0; attempt < 18; attempt += 1) {
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
