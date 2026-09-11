import { describe, expect, it } from "vitest";
import {
  inventoryImageKey,
  pickInventoryTarget,
  prepareInventorySave,
  type InventoryWorkspace,
} from "./inventoryStore";

const workspace = (overrides: Partial<InventoryWorkspace> = {}): InventoryWorkspace => ({
  environment: "preview",
  targets: [
    {
      kind: "preview",
      label: "Preview website",
      d1DatabaseId: "d1-preview",
      r2BucketName: "preview-images",
      r2PublicUrl: "https://pub.example",
      siteUrl: "https://preview.example",
      adminUrl: "https://preview.example/admin",
      ready: true,
    },
    {
      kind: "production",
      label: "Live website",
      d1DatabaseId: "d1-live",
      r2BucketName: "live-images",
      r2PublicUrl: "https://live.example",
      siteUrl: "https://live.example",
      adminUrl: "https://live.example/admin",
      ready: true,
    },
  ],
  categories: [{ slug: "hot-tub", label: "Hot Tubs" }],
  d1Enabled: true,
  r2Enabled: true,
  blockedBy: null,
  ...overrides,
});

describe("inventory store helpers", () => {
  it("prefers the live database unless preview is requested", () => {
    expect(pickInventoryTarget(workspace())?.kind).toBe("production");
    expect(pickInventoryTarget(workspace(), "preview")?.kind).toBe("preview");
  });

  it("rejects a save when no product group is enabled", () => {
    expect(
      prepareInventorySave(workspace({ categories: [] }), {
        inventory_name: "Caldera",
        category: "hot-tub",
      }),
    ).toEqual({
      ok: false,
      error: "Invalid category. This site sells: (none enabled).",
    });
  });

  it("keeps gallery photos and featured when preparing a save", () => {
    const result = prepareInventorySave(workspace(), {
      inventory_name: "Caldera",
      category: "hot-tub",
      featured: true,
      gallery_images: ["https://live.example/a.webp", "/images/b.webp"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.featured).toBe(1);
      expect(result.product.gallery_images).toEqual([
        "https://live.example/a.webp",
        "/images/b.webp",
      ]);
    }
  });

  it("names uploaded product images under products/", () => {
    expect(inventoryImageKey("Caldera Hero.PNG", "image/png")).toMatch(
      /^products\/\d+-caldera-hero\.png$/,
    );
  });
});
