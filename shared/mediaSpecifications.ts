export const MEDIA_UPLOAD_MIME_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;

export type MediaUploadMimeType = (typeof MEDIA_UPLOAD_MIME_TYPES)[number];

export type MediaSpecification = {
  key: "hero" | "landscape" | "square" | "logo" | "social" | "portrait" | "favicon";
  label: string;
  width: number;
  height: number;
  aspectLabel: string;
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  mimeTypes: readonly MediaUploadMimeType[];
};

const MB = 1024 * 1024;

export const MEDIA_SPECIFICATIONS: Record<MediaSpecification["key"], MediaSpecification> = {
  hero: {
    key: "hero",
    label: "WebP, JPEG or PNG · 1600 × 900 px · 16:9 · Max 2 MB",
    width: 1600,
    height: 900,
    aspectLabel: "16:9",
    maxBytes: 2 * MB,
    minWidth: 1200,
    minHeight: 675,
    mimeTypes: MEDIA_UPLOAD_MIME_TYPES,
  },
  landscape: {
    key: "landscape",
    label: "WebP, JPEG or PNG · 1200 × 800 px · 3:2 · Max 2 MB",
    width: 1200,
    height: 800,
    aspectLabel: "3:2",
    maxBytes: 2 * MB,
    minWidth: 900,
    minHeight: 600,
    mimeTypes: MEDIA_UPLOAD_MIME_TYPES,
  },
  square: {
    key: "square",
    label: "WebP, JPEG or PNG · 1200 × 1200 px · 1:1 · Max 2 MB",
    width: 1200,
    height: 1200,
    aspectLabel: "1:1",
    maxBytes: 2 * MB,
    minWidth: 800,
    minHeight: 800,
    mimeTypes: MEDIA_UPLOAD_MIME_TYPES,
  },
  logo: {
    key: "logo",
    label: "WebP or PNG · 800 × 400 px · 2:1 · Transparent preferred · Max 2 MB",
    width: 800,
    height: 400,
    aspectLabel: "2:1",
    maxBytes: 2 * MB,
    minWidth: 400,
    minHeight: 200,
    mimeTypes: ["image/webp", "image/png"],
  },
  social: {
    key: "social",
    label: "WebP, JPEG or PNG · 1200 × 630 px · 1.91:1 · Max 2 MB",
    width: 1200,
    height: 630,
    aspectLabel: "1.91:1",
    maxBytes: 2 * MB,
    minWidth: 1200,
    minHeight: 630,
    mimeTypes: MEDIA_UPLOAD_MIME_TYPES,
  },
  portrait: {
    key: "portrait",
    label: "WebP, JPEG or PNG · 1200 × 1500 px · 4:5 · Max 2 MB",
    width: 1200,
    height: 1500,
    aspectLabel: "4:5",
    maxBytes: 2 * MB,
    minWidth: 800,
    minHeight: 1000,
    mimeTypes: MEDIA_UPLOAD_MIME_TYPES,
  },
  favicon: {
    key: "favicon",
    label: "WebP or PNG · 512 × 512 px · 1:1 · Max 1 MB",
    width: 512,
    height: 512,
    aspectLabel: "1:1",
    maxBytes: MB,
    minWidth: 256,
    minHeight: 256,
    mimeTypes: ["image/webp", "image/png"],
  },
};

const CLIENT_SLOT_SPECIFICATIONS: Record<string, MediaSpecification["key"]> = {
  logo: "logo",
  hero: "hero",
  hotTubs: "landscape",
  swimSpas: "landscape",
  showroom: "landscape",
  product: "landscape",
  delivery: "landscape",
};

const ASTRO_SLOT_SPECIFICATIONS: Record<string, MediaSpecification["key"]> = {
  navLogo: "logo",
  footerLogo: "logo",
  inventoryLogo: "logo",
  favicon: "favicon",
  ogImage: "social",
  categoryHotTubs: "hero",
  categorySwimSpas: "hero",
  categorySaunas: "hero",
  categoryColdPlunge: "hero",
  categoryMassageChairs: "hero",
};

export function mediaSpecificationForAsset(
  assetKind: "client" | "astro",
  slot: string,
): MediaSpecification {
  const key = (assetKind === "client" ? CLIENT_SLOT_SPECIFICATIONS : ASTRO_SLOT_SPECIFICATIONS)[slot];
  return MEDIA_SPECIFICATIONS[key ?? "landscape"];
}

export type ImageMetadata = {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

export function validateImageMetadata(
  metadata: ImageMetadata,
  spec: MediaSpecification,
): string | null {
  if (!spec.mimeTypes.includes(metadata.mimeType as MediaUploadMimeType)) {
    return `Use ${spec.mimeTypes.map(type => type.replace("image/", "").toUpperCase()).join(", ")} format.`;
  }
  if (metadata.sizeBytes > spec.maxBytes) {
    return `Keep the file under ${Math.round(spec.maxBytes / MB)} MB.`;
  }
  if (metadata.width < spec.minWidth || metadata.height < spec.minHeight) {
    return `Image must be at least ${spec.minWidth} × ${spec.minHeight} px.`;
  }
  const actualRatio = metadata.width / metadata.height;
  const targetRatio = spec.width / spec.height;
  if (Math.abs(actualRatio - targetRatio) / targetRatio > 0.035) {
    return `Use a ${spec.aspectLabel} image so it does not crop strangely.`;
  }
  return null;
}
