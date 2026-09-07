import { describe, expect, it } from "vitest";
import {
  ASTRO_ASSET_SLOT_VALUES,
  ASTRO_CATEGORY_VALUES,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { ASSET_SLOT_VALUES } from "@shared/client";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import {
  applyLibrarySlotImages,
  astroSlotId,
  buildMediaBrowseEntries,
  buildMediaSlotCatalog,
  clientSlotId,
  countAddedByGroup,
  filterMediaBrowseEntries,
  firstMissingSlotId,
  groupMediaSlots,
  libraryBrowseId,
  nextMissingSlotId,
  resolveMediaSlots,
  type StoredMediaImage,
} from "./mediaSlots";

function configWith(enabled: boolean): AstroClientConfigInput {
  return {
    categories: Object.fromEntries(
      ASTRO_CATEGORY_VALUES.map(category => [category, { enabled }]),
    ),
  } as unknown as AstroClientConfigInput;
}

function image(filename: string): StoredMediaImage {
  return { storageUrl: `https://cdn.test/${filename}`, filename, byteSize: 2048 };
}

const catalog = buildMediaSlotCatalog(configWith(true));

describe("buildMediaSlotCatalog", () => {
  it("covers every astro and client slot exactly once", () => {
    expect(catalog).toHaveLength(ASTRO_ASSET_SLOT_VALUES.length + ASSET_SLOT_VALUES.length);
    expect(new Set(catalog.map(slot => slot.id)).size).toBe(catalog.length);
  });

  it("emits an entry for each astro slot and each client slot", () => {
    const ids = new Set(catalog.map(slot => slot.id));
    for (const slot of ASTRO_ASSET_SLOT_VALUES) expect(ids.has(astroSlotId(slot))).toBe(true);
    for (const slot of ASSET_SLOT_VALUES) expect(ids.has(clientSlotId(slot))).toBe(true);
  });

  it("orders groups brand, then category, then marketing", () => {
    const groups = catalog.map(slot => slot.group);
    expect(groups.indexOf("brand")).toBe(0);
    expect(groups.lastIndexOf("brand")).toBeLessThan(groups.indexOf("category"));
    expect(groups.lastIndexOf("category")).toBeLessThan(groups.indexOf("marketing"));
  });

  it("marks only the four deploy-blocking astro slots as required", () => {
    const required = catalog.filter(slot => slot.kind === "astro" && slot.required).map(slot => slot.slot);
    expect(required.sort()).toEqual(["favicon", "footerLogo", "navLogo", "ogImage"]);
  });

  it("tells the operator where to turn a hidden category back on", () => {
    const hidden = buildMediaSlotCatalog(configWith(false)).find(
      slot => slot.id === astroSlotId("categorySaunas"),
    );
    expect(hidden?.guidance).toContain("hidden");
    const shown = catalog.find(slot => slot.id === astroSlotId("categorySaunas"));
    expect(shown?.guidance).toContain("Saunas");
    expect(shown?.guidance).not.toContain("hidden");
  });
});

describe("resolveMediaSlots", () => {
  it("reads astro and client slots from their own asset maps", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map([["navLogo", image("nav.webp")]]),
      new Map([["hero", image("hero.webp")]]),
    );
    expect(resolved.find(slot => slot.id === astroSlotId("navLogo"))?.added).toBe(true);
    expect(resolved.find(slot => slot.id === clientSlotId("hero"))?.added).toBe(true);
    expect(resolved.find(slot => slot.id === astroSlotId("favicon"))?.added).toBe(false);
  });

  it("does not let a client slot satisfy the similarly named astro slot", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map(),
      new Map([["hotTubs", image("hot-tubs.webp")]]),
    );
    expect(resolved.find(slot => slot.id === clientSlotId("hotTubs"))?.added).toBe(true);
    expect(resolved.find(slot => slot.id === astroSlotId("categoryHotTubs"))?.added).toBe(false);
  });

  it("carries the stored image through for previews", () => {
    const resolved = resolveMediaSlots(catalog, new Map([["favicon", image("icon.png")]]), new Map());
    expect(resolved.find(slot => slot.id === astroSlotId("favicon"))?.image?.filename).toBe("icon.png");
  });
});

describe("applyLibrarySlotImages", () => {
  function libraryItem(slot: string, filename: string): MediaLibraryItemView {
    return {
      id: 61,
      storageUrl: `/local-assets/${filename}`,
      alt: "Showroom soak",
      description: "Filled spa on the floor",
      filename,
      originalFilename: filename,
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1600,
      height: 900,
      slots: [slot],
      createdAt: "2026-09-07",
    };
  }

  it("fills a missing marketing slot from its library assignment", () => {
    const resolved = resolveMediaSlots(catalog, new Map(), new Map());
    const filled = applyLibrarySlotImages(resolved, [libraryItem("logo", "logo.webp")]);
    const logo = filled.find(slot => slot.id === clientSlotId("logo"));
    expect(logo?.added).toBe(true);
    expect(logo?.image?.storageUrl).toBe("/local-assets/logo.webp");
    expect(logo?.image?.mediaItemId).toBe(61);
    expect(logo?.image?.alt).toBe("Showroom soak");
  });

  it("keeps an already-resolved image URL and overlays library copy", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map(),
      new Map([["logo", image("existing-logo.webp")]]),
    );
    const filled = applyLibrarySlotImages(resolved, [libraryItem("logo", "library-logo.webp")]);
    const logo = filled.find(slot => slot.id === clientSlotId("logo"));
    expect(logo?.image?.storageUrl).toBe("https://cdn.test/existing-logo.webp");
    expect(logo?.image?.filename).toBe("existing-logo.webp");
    expect(logo?.image?.alt).toBe("Showroom soak");
    expect(logo?.image?.mediaItemId).toBe(61);
  });
});

describe("groupMediaSlots", () => {
  const resolved = resolveMediaSlots(catalog, new Map(), new Map());

  it("returns the three groups in catalog order", () => {
    expect(groupMediaSlots(resolved).map(entry => entry.group)).toEqual([
      "brand",
      "category",
      "marketing",
    ]);
  });

  it("keeps every slot exactly once across the groups", () => {
    const flattened = groupMediaSlots(resolved).flatMap(entry => entry.slots);
    expect(flattened.map(slot => slot.id)).toEqual(resolved.map(slot => slot.id));
  });

  it("omits a group with no slots", () => {
    const brandOnly = resolved.filter(slot => slot.group === "brand");
    expect(groupMediaSlots(brandOnly).map(entry => entry.group)).toEqual(["brand"]);
  });
});

describe("countAddedByGroup", () => {
  it("counts each group against its own total", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map([["navLogo", image("nav.webp")], ["categorySaunas", image("saunas.webp")]]),
      new Map([["logo", image("logo.webp")]]),
    );
    expect(countAddedByGroup(resolved)).toEqual({
      brand: { added: 1, total: 5 },
      category: { added: 1, total: 5 },
      marketing: { added: 1, total: 7 },
    });
  });
});

describe("nextMissingSlotId", () => {
  const allMissing = resolveMediaSlots(catalog, new Map(), new Map());

  it("walks forward in catalog order", () => {
    expect(nextMissingSlotId(allMissing, allMissing[0].id)).toBe(allMissing[1].id);
  });

  it("skips slots that already have an image", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map([["footerLogo", image("footer.webp")], ["inventoryLogo", image("inv.webp")]]),
      new Map(),
    );
    expect(nextMissingSlotId(resolved, astroSlotId("navLogo"))).toBe(astroSlotId("favicon"));
  });

  it("crosses from astro slots into client slots", () => {
    const upToMarketing = new Map(
      catalog
        .filter(slot => slot.kind === "astro")
        .map(slot => [slot.slot, image(`${slot.slot}.webp`)] as const),
    );
    const resolved = resolveMediaSlots(catalog, upToMarketing, new Map());
    expect(nextMissingSlotId(resolved, astroSlotId("navLogo"))).toBe(clientSlotId("logo"));
  });

  it("returns null at the end instead of wrapping", () => {
    const last = allMissing[allMissing.length - 1];
    expect(nextMissingSlotId(allMissing, last.id)).toBeNull();
  });

  it("returns null when everything is uploaded", () => {
    const resolved = resolveMediaSlots(
      catalog,
      new Map(ASTRO_ASSET_SLOT_VALUES.map(slot => [slot, image(`${slot}.webp`)])),
      new Map(ASSET_SLOT_VALUES.map(slot => [slot, image(`${slot}.webp`)])),
    );
    expect(nextMissingSlotId(resolved, resolved[0].id)).toBeNull();
    expect(firstMissingSlotId(resolved)).toBeNull();
  });

  it("starts from the top when the current id is unknown", () => {
    expect(nextMissingSlotId(allMissing, "astro:nope")).toBe(allMissing[0].id);
  });
});

describe("media browse filters", () => {
  const slots = resolveMediaSlots(
    catalog,
    new Map([["navLogo", { ...image("nav.webp"), alt: "Header mark", mediaItemId: 9 }]]),
    new Map(),
  );
  const library = [
    {
      id: 9,
      storageUrl: "https://cdn.test/nav.webp",
      filename: "nav.webp",
      originalFilename: "nav.png",
      mimeType: "image/webp",
      byteSize: 2048,
      width: 800,
      height: 400,
      alt: "Header mark",
      description: "",
      slots: ["navLogo"],
      createdAt: "2026-09-04T12:00:00.000Z",
    },
    {
      id: 21,
      storageUrl: "https://cdn.test/showroom.webp",
      filename: "showroom.webp",
      originalFilename: "showroom.jpg",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1600,
      height: 900,
      alt: "Showroom floor",
      description: "Main floor",
      slots: [],
      createdAt: "2026-09-04T12:00:00.000Z",
    },
  ];

  it("keeps assigned library photos on their slot instead of duplicating them", () => {
    const entries = buildMediaBrowseEntries(slots, library);
    expect(entries.filter(entry => entry.kind === "library")).toHaveLength(1);
    expect(entries.find(entry => entry.kind === "library" && entry.item.id === 21)).toBeTruthy();
    expect(entries.find(entry => entry.kind === "slot" && entry.slot.slot === "navLogo")).toBeTruthy();
  });

  it("filters by missing placements, group, and search text", () => {
    const entries = buildMediaBrowseEntries(slots, library);
    expect(filterMediaBrowseEntries(entries, "", "missing").every(entry => entry.kind === "slot" && !entry.slot.added)).toBe(true);
    expect(filterMediaBrowseEntries(entries, "", "brand").every(entry => entry.kind === "slot" && entry.slot.group === "brand")).toBe(true);
    expect(filterMediaBrowseEntries(entries, "showroom", "all").map(entry => entry.id)).toEqual([
      clientSlotId("showroom"),
      libraryBrowseId(21),
    ]);
    expect(filterMediaBrowseEntries(entries, "header", "all")[0]?.id).toBe(astroSlotId("navLogo"));
  });
});
