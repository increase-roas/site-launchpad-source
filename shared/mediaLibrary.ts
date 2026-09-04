export const MEDIA_ITEM_ALT_MAX = 240;
export const MEDIA_ITEM_DESCRIPTION_MAX = 2000;
export const LIBRARY_UPLOAD_SLOT = "library" as const;

export type MediaLibraryItemRef = {
  id: number;
  storageUrl: string;
  alt: string;
  description: string;
};

export type MediaLibraryItemView = MediaLibraryItemRef & {
  filename: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  slots: string[];
  createdAt: Date | string;
};

export type GalleryImage = {
  id?: number;
  src: string;
  alt: string;
  description: string;
};

export function defaultAltFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMediaItemMetadata(input: {
  alt?: string | null;
  description?: string | null;
}): { alt: string; description: string } {
  return {
    alt: (input.alt ?? "").trim().slice(0, MEDIA_ITEM_ALT_MAX),
    description: (input.description ?? "").trim().slice(0, MEDIA_ITEM_DESCRIPTION_MAX),
  };
}

function isAbsoluteAsset(value: string): boolean {
  return value.startsWith("/") || value.startsWith("https://");
}

function asGalleryImage(value: unknown): GalleryImage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const src = typeof record.src === "string" ? record.src.trim() : "";
  if (!isAbsoluteAsset(src)) return null;
  const id = typeof record.id === "number" && Number.isInteger(record.id) && record.id > 0
    ? record.id
    : undefined;
  const copy = normalizeMediaItemMetadata({
    alt: typeof record.alt === "string" ? record.alt : "",
    description: typeof record.description === "string" ? record.description : "",
  });
  return id === undefined ? { src, ...copy } : { id, src, ...copy };
}

export function parseGalleryImages(field: string): GalleryImage[] {
  const trimmed = field.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(asGalleryImage).filter((image): image is GalleryImage => image !== null);
      }
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map(src => src.trim())
    .filter(isAbsoluteAsset)
    .map(src => ({ src, alt: "", description: "" }));
}

export function serializeGalleryImages(images: GalleryImage[]): string {
  return JSON.stringify(images.map(image => {
    const copy = normalizeMediaItemMetadata(image);
    return image.id === undefined
      ? { src: image.src.trim(), ...copy }
      : { id: image.id, src: image.src.trim(), ...copy };
  }));
}

export function resolveGalleryImages(
  field: string,
  library: readonly MediaLibraryItemRef[],
  fallbackAlt: string,
): Array<{ src: string; alt: string }> {
  const libraryById = new Map(library.map(item => [item.id, item]));
  const heading = fallbackAlt.trim();
  return parseGalleryImages(field).map(image => {
    const live = image.id === undefined ? undefined : libraryById.get(image.id);
    const src = live?.storageUrl ?? image.src;
    const alt = (live?.alt ?? image.alt).trim() || heading;
    return { src, alt };
  }).filter(image => isAbsoluteAsset(image.src) && image.alt.length > 0);
}
