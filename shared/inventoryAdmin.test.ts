import { describe, expect, it } from "vitest";
import { BUSINESS_DAY_VALUES } from "./client";
import { createDefaultAstroConfig } from "./astroConfig";
import {
  cleanInventoryImageUrl,
  enabledInventoryCategories,
  slugifyInventory,
  validateInventoryProduct,
} from "./inventoryAdmin";

const client = {
  businessName: "North Star Spas",
  shortName: "north-star",
  foundedYear: 1994,
  tagline: "Relax better at home",
  websiteUrl: "https://northstar.example.com",
  phone: "+17015551234",
  email: "hello@northstar.example.com",
  streetAddress: "100 Main Street",
  city: "Minot",
  state: "ND",
  postalCode: "58701",
  country: "US",
  businessHours: BUSINESS_DAY_VALUES.map((day, index) => ({
    day,
    isOpen: index < 5,
    opensAt: index < 5 ? "09:00" : "",
    closesAt: index < 5 ? "17:00" : "",
  })),
  facebookUrl: "https://facebook.com/northstar",
  theme: "mono" as const,
};

describe("inventory admin", () => {
  it("maps only enabled Launchpad categories onto live-site slugs", () => {
    const config = createDefaultAstroConfig(client);
    config.categories["hot-tubs"].enabled = true;
    config.categories["hot-tubs"].label = "Hot Tubs";
    config.categories.saunas.enabled = true;
    config.categories.saunas.label = "Saunas";

    expect(enabledInventoryCategories(config)).toEqual([
      { slug: "hot-tub", label: "Hot Tubs" },
      { slug: "sauna", label: "Saunas" },
    ]);
  });

  it("builds a URL slug from the product name", () => {
    expect(slugifyInventory("Caldera Utopia 2024!")).toBe("caldera-utopia-2024");
  });

  it("accepts a product in an enabled category", () => {
    const result = validateInventoryProduct(
      {
        inventory_name: "Caldera Utopia",
        category: "hot-tub",
        status: "available",
        price: 12995,
        primary_image: "https://images.example.com/tub.webp",
      },
      ["hot-tub", "sauna"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.slug).toBe("caldera-utopia");
      expect(result.product.primary_image).toBe(
        "https://images.example.com/tub.webp",
      );
    }
  });

  it("keeps gallery photos and featured on save", () => {
    const result = validateInventoryProduct(
      {
        inventory_name: "Caldera Utopia",
        category: "hot-tub",
        featured: true,
        gallery_images: [
          "https://images.example.com/a.webp",
          "http://insecure.example/b.webp",
          "/images/c.webp",
        ],
      },
      ["hot-tub"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.featured).toBe(1);
      expect(result.product.gallery_images).toEqual([
        "https://images.example.com/a.webp",
        "/images/c.webp",
      ]);
    }
  });

  it("defaults missing gallery and featured so callers must send them to keep them", () => {
    const result = validateInventoryProduct(
      { inventory_name: "Caldera Utopia", category: "hot-tub" },
      ["hot-tub"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.featured).toBe(0);
      expect(result.product.gallery_images).toEqual([]);
    }
  });

  it("rejects a category the site does not sell", () => {
    const result = validateInventoryProduct(
      { inventory_name: "Sauna", category: "sauna" },
      ["hot-tub"],
    );
    expect(result).toEqual({
      ok: false,
      error: "Invalid category. This site sells: hot-tub.",
    });
  });

  it("keeps only https or root-relative image URLs", () => {
    expect(cleanInventoryImageUrl("/images/tub.webp")).toBe("/images/tub.webp");
    expect(cleanInventoryImageUrl("https://cdn.example.com/a.webp")).toBe(
      "https://cdn.example.com/a.webp",
    );
    expect(cleanInventoryImageUrl("http://insecure.example/a.webp")).toBe("");
    expect(cleanInventoryImageUrl("images/relative.webp")).toBe("");
  });
});
