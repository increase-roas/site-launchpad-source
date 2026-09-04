import { ASTRO_ASSET_SLOT_VALUES } from "../shared/astroConfig";
import { ASSET_SLOT_VALUES } from "../shared/client";
import {
  mediaSpecificationForAsset,
  validateImageMetadata,
} from "../shared/mediaSpecifications";
import { normalizeMediaItemMetadata } from "../shared/mediaLibrary";

export type MediaLibraryItemDto = {
  id: number;
  storageUrl: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  alt: string;
  description: string;
  slots: string[];
  createdAt: Date;
};

export type MediaLibraryPlacementKind = "client" | "astro";

const CLIENT_SLOT_SET = new Set<string>(ASSET_SLOT_VALUES);
const ASTRO_SLOT_SET = new Set<string>(ASTRO_ASSET_SLOT_VALUES);

export function isMediaLibraryPlacement(
  assetKind: string,
  slot: string,
): assetKind is MediaLibraryPlacementKind {
  if (assetKind === "client") return CLIENT_SLOT_SET.has(slot);
  if (assetKind === "astro") return ASTRO_SLOT_SET.has(slot);
  return false;
}

export function mediaLibraryAssignmentError(
  item: {
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  },
  assetKind: MediaLibraryPlacementKind,
  slot: string,
): string | null {
  return validateImageMetadata(
    {
      mimeType: item.mimeType,
      sizeBytes: item.byteSize,
      width: item.width,
      height: item.height,
    },
    mediaSpecificationForAsset(assetKind, slot),
  );
}

export function toMediaLibraryItemDto(
  item: {
    id: number;
    storageUrl: string;
    filename: string;
    originalFilename: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
    alt: string;
    description: string;
    createdAt: Date;
  },
  slots: readonly string[],
): MediaLibraryItemDto {
  const copy = normalizeMediaItemMetadata(item);
  return {
    id: item.id,
    storageUrl: item.storageUrl,
    filename: item.filename,
    originalFilename: item.originalFilename,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    width: item.width,
    height: item.height,
    alt: copy.alt,
    description: copy.description,
    slots: [...slots],
    createdAt: item.createdAt,
  };
}

