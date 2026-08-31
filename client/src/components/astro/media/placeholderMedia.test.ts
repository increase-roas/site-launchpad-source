import { ASTRO_CATEGORY_VALUES, type AstroClientConfigInput } from "@shared/astroConfig";
import { describe, expect, it } from "vitest";
import {
  astroSlotId,
  buildMediaSlotCatalog,
  clientSlotId,
  resolveMediaSlots,
  type ResolvedMediaSlot,
  type StoredMediaImage,
} from "./mediaSlots";
import { describePlaceholder, planPlaceholderFill } from "./placeholderMedia";

function config(): AstroClientConfigInput {
  return {
    categories: Object.fromEntries(
      ASTRO_CATEGORY_VALUES.map(category => [category, { enabled: true }]),
    ),
  } as unknown as AstroClientConfigInput;
}

function image(filename: string): StoredMediaImage {
  return { storageUrl: `https://cdn.test/${filename}`, filename, byteSize: 2048 };
}

const catalog = buildMediaSlotCatalog(config());

function slotsWith(
  astroAssets: Array<[string, StoredMediaImage]> = [],
  clientAssets: Array<[string, StoredMediaImage]> = [],
): ResolvedMediaSlot[] {
  return resolveMediaSlots(catalog, new Map(astroAssets), new Map(clientAssets));
}

function slotById(id: string): ResolvedMediaSlot {
  const slot = slotsWith().find(candidate => candidate.id === id);
  if (!slot) throw new Error(`Unknown slot: ${id}`);
  return slot;
}

describe("describePlaceholder", () => {
  it("renders at the exact pixel size the slot specification demands", () => {
    const slot = slotById(astroSlotId("ogImage"));
    const descriptor = describePlaceholder(slot);
    expect(descriptor.width).toBe(slot.specification.width);
    expect(descriptor.height).toBe(slot.specification.height);
  });

  it("picks a mime type the slot accepts", () => {
    for (const slot of slotsWith()) {
      const descriptor = describePlaceholder(slot);
      expect(slot.specification.mimeTypes).toContain(descriptor.mimeType);
    }
  });

  it("names the file after the slot so uploads stay identifiable", () => {
    const descriptor = describePlaceholder(slotById(clientSlotId("showroom")));
    expect(descriptor.filename).toBe("placeholder-client-showroom-1200x800.png");
  });

  it("captions the image with its size and aspect ratio", () => {
    const slot = slotById(astroSlotId("favicon"));
    const descriptor = describePlaceholder(slot);
    expect(descriptor.caption).toBe("512 × 512 · 1:1");
  });

  it("keeps the accent colour stable for a slot", () => {
    const first = describePlaceholder(slotById(astroSlotId("navLogo")));
    const second = describePlaceholder(slotById(astroSlotId("navLogo")));
    expect(first.accentHue).toBe(second.accentHue);
  });

  it("separates the groups by hue so the set reads as structured", () => {
    const brand = describePlaceholder(slotById(astroSlotId("navLogo")));
    const category = describePlaceholder(slotById(astroSlotId("categorySaunas")));
    const marketing = describePlaceholder(slotById(clientSlotId("delivery")));
    expect(new Set([brand.accentHue, category.accentHue, marketing.accentHue]).size).toBe(3);
  });
});

describe("planPlaceholderFill", () => {
  it("covers every slot when nothing has been uploaded", () => {
    expect(planPlaceholderFill(slotsWith())).toHaveLength(catalog.length);
  });

  it("skips slots that already hold an image", () => {
    const plan = planPlaceholderFill(
      slotsWith([["navLogo", image("nav.webp")]], [["hero", image("hero.webp")]]),
    );
    const ids = plan.map(descriptor => descriptor.slotId);
    expect(ids).not.toContain(astroSlotId("navLogo"));
    expect(ids).not.toContain(clientSlotId("hero"));
    expect(ids).toContain(astroSlotId("favicon"));
  });

  it("keeps catalog order so the tab fills top to bottom", () => {
    const plan = planPlaceholderFill(slotsWith());
    expect(plan.map(descriptor => descriptor.slotId)).toEqual(catalog.map(slot => slot.id));
  });

  it("returns nothing once every slot is filled", () => {
    const filled = slotsWith(
      catalog.filter(slot => slot.kind === "astro").map(slot => [slot.slot, image("a.webp")]),
      catalog.filter(slot => slot.kind === "client").map(slot => [slot.slot, image("c.webp")]),
    );
    expect(planPlaceholderFill(filled)).toEqual([]);
  });
});
