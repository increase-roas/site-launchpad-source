import type { MediaUploadMimeType } from "@shared/mediaSpecifications";
import {
  MEDIA_GROUP_LABELS,
  type MediaGroup,
  type ResolvedMediaSlot,
} from "./mediaSlots";

/**
 * Stand-in artwork for the development database, where no real photography has
 * been uploaded yet. Every descriptor matches its slot specification exactly so
 * the generated file clears the same validation a real upload has to clear.
 */
export type PlaceholderDescriptor = {
  slotId: string;
  label: string;
  groupLabel: string;
  caption: string;
  filename: string;
  mimeType: MediaUploadMimeType;
  width: number;
  height: number;
  accentHue: number;
};

/** Hues are far enough apart that a filled tab reads as three distinct bands. */
const GROUP_BASE_HUE: Record<MediaGroup, number> = {
  brand: 212,
  category: 152,
  marketing: 24,
};

const HUE_SPREAD = 18;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function accentHueFor(slot: ResolvedMediaSlot): number {
  const offset = (stableHash(slot.id) % (HUE_SPREAD * 2 + 1)) - HUE_SPREAD;
  return GROUP_BASE_HUE[slot.group] + offset;
}

function extensionFor(mimeType: MediaUploadMimeType): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    default: {
      const exhaustive: never = mimeType;
      throw new Error(`Unhandled placeholder mime type: ${String(exhaustive)}`);
    }
  }
}

/** PNG is accepted by every slot and stays lossless for flat generated art. */
function mimeTypeFor(slot: ResolvedMediaSlot): MediaUploadMimeType {
  const { mimeTypes } = slot.specification;
  return mimeTypes.includes("image/png") ? "image/png" : mimeTypes[0];
}

export function describePlaceholder(slot: ResolvedMediaSlot): PlaceholderDescriptor {
  const { width, height, aspectLabel } = slot.specification;
  const mimeType = mimeTypeFor(slot);
  return {
    slotId: slot.id,
    label: slot.label,
    groupLabel: MEDIA_GROUP_LABELS[slot.group],
    caption: `${width} × ${height} · ${aspectLabel}`,
    filename: `placeholder-${slot.kind}-${slot.slot}-${width}x${height}.${extensionFor(mimeType)}`,
    mimeType,
    width,
    height,
    accentHue: accentHueFor(slot),
  };
}

/** Slots that already hold an image are left alone, so a fill is never destructive. */
export function planPlaceholderFill(slots: ResolvedMediaSlot[]): PlaceholderDescriptor[] {
  return slots.filter(slot => !slot.added).map(describePlaceholder);
}
