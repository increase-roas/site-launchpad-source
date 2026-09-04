import {
  ASTRO_ASSET_LABELS,
  ASTRO_CATEGORY_VALUES,
  type AstroAssetSlot,
  type AstroCategory,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { REQUIRED_ASSET_SLOTS } from "@shared/astroConfigReadiness";
import { ASSET_SLOT_LABELS, ASSET_SLOT_VALUES, type AssetSlot } from "@shared/client";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import { mediaSpecificationForAsset, type MediaSpecification } from "@shared/mediaSpecifications";
import { CATEGORY_ASSET_SLOT, CATEGORY_LABELS } from "../categories";

/**
 * The media tab spans two unrelated asset systems: astro slots feed the
 * published website, client slots feed the launch checklist and the funnels.
 * They share nothing downstream, so this module is the only place that flattens
 * them into a single ordered list for the picker to walk.
 */

export const MEDIA_GROUP_VALUES = ["brand", "category", "marketing"] as const;
export type MediaGroup = (typeof MEDIA_GROUP_VALUES)[number];

export const MEDIA_GROUP_LABELS: Record<MediaGroup, string> = {
  brand: "Brand images",
  category: "Category photos",
  marketing: "Marketing photos",
};

export const MEDIA_GROUP_DESCRIPTIONS: Record<MediaGroup, string> = {
  brand: "Logos and icons the template places in the header, footer, browser tab, and social previews.",
  category: "One hero photo per category page. Photos for hidden categories stay saved but are not published.",
  marketing: "The photo set the launch checklist counts. Stored on the client, separate from the template's own images.",
};

export type MediaSlotDescriptor =
  | {
      id: string;
      kind: "astro";
      slot: AstroAssetSlot;
      group: MediaGroup;
      label: string;
      guidance: string;
      specification: MediaSpecification;
      required: boolean;
      category?: AstroCategory;
    }
  | {
      id: string;
      kind: "client";
      slot: AssetSlot;
      group: MediaGroup;
      label: string;
      guidance: string;
      specification: MediaSpecification;
      required: boolean;
    };

export type StoredMediaImage = {
  storageUrl: string;
  filename: string;
  byteSize: number;
  mediaItemId?: number | null;
  alt?: string;
  description?: string;
};

export type ResolvedMediaSlot = MediaSlotDescriptor & {
  image?: StoredMediaImage;
  added: boolean;
};

const BRAND_ASSET_SLOTS: AstroAssetSlot[] = [
  "navLogo",
  "footerLogo",
  "inventoryLogo",
  "favicon",
  "ogImage",
];

const BRAND_GUIDANCE: Record<string, string> = {
  navLogo: "Shown in the site header.",
  footerLogo: "Shown in the site footer.",
  inventoryLogo: "Shown on inventory listings.",
  favicon: "Square brand icon shown in browser tabs.",
  ogImage: "Wide image used when the site is shared.",
};

const MARKETING_GUIDANCE: Record<AssetSlot, string> = {
  logo: "Kept with the client record and used in exports.",
  hero: "Main photo for marketing pages.",
  hotTubs: "Hot tubs photo for marketing pages.",
  swimSpas: "Swim spas photo for marketing pages.",
  showroom: "Showroom photo for marketing pages.",
  product: "Product photo for marketing pages.",
  delivery: "Delivery photo for marketing pages.",
};

const requiredAstroSlots = new Set<string>(REQUIRED_ASSET_SLOTS);

export function astroSlotId(slot: AstroAssetSlot): string {
  return `astro:${slot}`;
}

export function clientSlotId(slot: AssetSlot): string {
  return `client:${slot}`;
}

/**
 * Category guidance depends on whether the category is published, so the
 * catalog is rebuilt whenever the config changes rather than kept as a const.
 */
export function buildMediaSlotCatalog(config: AstroClientConfigInput): MediaSlotDescriptor[] {
  const brand: MediaSlotDescriptor[] = BRAND_ASSET_SLOTS.map(slot => ({
    id: astroSlotId(slot),
    kind: "astro",
    slot,
    group: "brand",
    label: ASTRO_ASSET_LABELS[slot],
    guidance: BRAND_GUIDANCE[slot] ?? "Used across the website.",
    specification: mediaSpecificationForAsset("astro", slot),
    required: requiredAstroSlots.has(slot),
  }));

  const category: MediaSlotDescriptor[] = ASTRO_CATEGORY_VALUES.map(categoryValue => {
    const slot = CATEGORY_ASSET_SLOT[categoryValue];
    const enabled = config.categories[categoryValue].enabled;
    return {
      id: astroSlotId(slot),
      kind: "astro",
      slot,
      group: "category",
      label: ASTRO_ASSET_LABELS[slot],
      guidance: enabled
        ? `Shown at the top of the ${CATEGORY_LABELS[categoryValue]} page.`
        : `${CATEGORY_LABELS[categoryValue]} is hidden — turn it on under Content.`,
      specification: mediaSpecificationForAsset("astro", slot),
      required: requiredAstroSlots.has(slot),
      category: categoryValue,
    };
  });

  const marketing: MediaSlotDescriptor[] = ASSET_SLOT_VALUES.map(slot => ({
    id: clientSlotId(slot),
    kind: "client",
    slot,
    group: "marketing",
    label: ASSET_SLOT_LABELS[slot],
    guidance: MARKETING_GUIDANCE[slot],
    specification: mediaSpecificationForAsset("client", slot),
    required: true,
  }));

  return [...brand, ...category, ...marketing];
}

export function resolveMediaSlots(
  catalog: MediaSlotDescriptor[],
  astroAssets: ReadonlyMap<string, StoredMediaImage>,
  clientAssets: ReadonlyMap<string, StoredMediaImage>,
): ResolvedMediaSlot[] {
  return catalog.map(descriptor => {
    const source = descriptor.kind === "astro" ? astroAssets : clientAssets;
    const image = source.get(descriptor.slot);
    return { ...descriptor, image, added: image !== undefined };
  });
}

/** Groups in catalog order, skipping any group that has no slots. */
export function groupMediaSlots(
  slots: ResolvedMediaSlot[],
): Array<{ group: MediaGroup; slots: ResolvedMediaSlot[] }> {
  return MEDIA_GROUP_VALUES.map(group => ({
    group,
    slots: slots.filter(slot => slot.group === group),
  })).filter(entry => entry.slots.length > 0);
}

export function countAddedByGroup(slots: ResolvedMediaSlot[]): Record<MediaGroup, { added: number; total: number }> {
  const counts: Record<MediaGroup, { added: number; total: number }> = {
    brand: { added: 0, total: 0 },
    category: { added: 0, total: 0 },
    marketing: { added: 0, total: 0 },
  };
  for (const slot of slots) {
    counts[slot.group].total += 1;
    if (slot.added) counts[slot.group].added += 1;
  }
  return counts;
}

/** Walks forward from `currentId` in catalog order. Does not wrap: the button disappears at the end. */
export function nextMissingSlotId(slots: ResolvedMediaSlot[], currentId: string): string | null {
  const start = slots.findIndex(slot => slot.id === currentId);
  const from = start < 0 ? 0 : start + 1;
  for (let index = from; index < slots.length; index += 1) {
    const candidate = slots[index];
    if (!candidate.added) return candidate.id;
  }
  return null;
}

export function firstMissingSlotId(slots: ResolvedMediaSlot[]): string | null {
  return slots.find(slot => !slot.added)?.id ?? null;
}

export const MEDIA_FILTER_VALUES = [
  "all",
  "missing",
  "brand",
  "category",
  "marketing",
  "library",
] as const;
export type MediaFilter = (typeof MEDIA_FILTER_VALUES)[number];

export const MEDIA_FILTER_LABELS: Record<MediaFilter, string> = {
  all: "All",
  missing: "Missing",
  brand: "Brand",
  category: "Category",
  marketing: "Marketing",
  library: "Library",
};

export type MediaBrowseEntry =
  | { id: string; kind: "slot"; slot: ResolvedMediaSlot }
  | { id: string; kind: "library"; item: MediaLibraryItemView };

export function libraryBrowseId(itemId: number): string {
  return `library:${itemId}`;
}

/** Slots first, then unplaced library photos. Assigned library files stay on their slot cards. */
export function buildMediaBrowseEntries(
  slots: ResolvedMediaSlot[],
  libraryItems: readonly MediaLibraryItemView[],
): MediaBrowseEntry[] {
  const placed = new Set(
    slots.flatMap(slot => (slot.image?.mediaItemId != null ? [slot.image.mediaItemId] : [])),
  );
  return [
    ...slots.map(slot => ({ id: slot.id, kind: "slot" as const, slot })),
    ...libraryItems
      .filter(item => item.slots.length === 0 && !placed.has(item.id))
      .map(item => ({ id: libraryBrowseId(item.id), kind: "library" as const, item })),
  ];
}

function entrySearchText(entry: MediaBrowseEntry): string {
  if (entry.kind === "slot") {
    const image = entry.slot.image;
    return [
      entry.slot.label,
      entry.slot.guidance,
      image?.filename,
      image?.alt,
      image?.description,
    ].filter(Boolean).join(" ").toLowerCase();
  }
  return [
    entry.item.filename,
    entry.item.originalFilename,
    entry.item.alt,
    entry.item.description,
    ...entry.item.slots,
  ].join(" ").toLowerCase();
}

export function filterMediaBrowseEntries(
  entries: readonly MediaBrowseEntry[],
  query: string,
  filter: MediaFilter,
): MediaBrowseEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter(entry => {
    switch (filter) {
      case "all":
        break;
      case "missing":
        if (entry.kind !== "slot" || entry.slot.added) return false;
        break;
      case "brand":
      case "category":
      case "marketing":
        if (entry.kind !== "slot" || entry.slot.group !== filter) return false;
        break;
      case "library":
        if (entry.kind !== "library") return false;
        break;
      default: {
        const exhaustive: never = filter;
        throw new Error(`Unhandled media filter: ${String(exhaustive)}`);
      }
    }
    return needle.length === 0 || entrySearchText(entry).includes(needle);
  });
}
