import { describe, expect, it } from "vitest";
import {
  applyAstroAssetUrls,
  mergeStoredAstroConfig,
  protectWranglerSecretValues,
} from "./astroConfigDb";
import { decryptSetupValue } from "./clientSecurity";
import { createDefaultAstroConfig } from "../shared/astroConfig";
import { BUSINESS_DAY_VALUES } from "../shared/client";

const defaultConfig = () => createDefaultAstroConfig({
  businessName: "Test Spas",
  shortName: "test-spas",
  foundedYear: 2001,
  tagline: "Test tagline",
  websiteUrl: "https://test.example.com",
  phone: "+17015551234",
  email: "test@example.com",
  streetAddress: "1 Main Street",
  city: "Minot",
  state: "ND",
  postalCode: "58701",
  country: "US",
  businessHours: BUSINESS_DAY_VALUES.map(day => ({ day, isOpen: false, opensAt: "", closesAt: "" })),
  facebookUrl: "",
  theme: "aqua",
});

describe("Astro config persistence helpers", () => {
  it("merges every persisted category hero asset into saved category data", () => {
    const config = defaultConfig();
    const merged = applyAstroAssetUrls(config, {
      categoryHotTubs: "/manus-storage/hot-tubs.webp",
      categorySwimSpas: "/manus-storage/swim-spas.webp",
      categorySaunas: "/manus-storage/saunas.webp",
      categoryColdPlunge: "/manus-storage/cold-plunge.webp",
      categoryMassageChairs: "/manus-storage/massage-chairs.webp",
    });
    expect(merged.categories["hot-tubs"].heroImage).toContain("hot-tubs.webp");
    expect(merged.categories["swim-spas"].heroImage).toContain("swim-spas.webp");
    expect(merged.categories.saunas.heroImage).toContain("saunas.webp");
    expect(merged.categories["cold-plunge"].heroImage).toContain("cold-plunge.webp");
    expect(merged.categories["massage-chairs"].heroImage).toContain("massage-chairs.webp");
  });

  it("encrypts entered Wrangler values and omits blank replacements", () => {
    const protectedValues = protectWranglerSecretValues({
      GHL_API_KEY: "  ghl-secret-value  ",
      META_CAPI_ACCESS_TOKEN: "meta-token-value",
      ADMIN_SESSION_SECRET: "",
    });
    expect(protectedValues.ghlApiKeyEncrypted).not.toContain("ghl-secret-value");
    expect(protectedValues.metaCapiAccessTokenEncrypted).not.toContain("meta-token-value");
    expect(decryptSetupValue(protectedValues.ghlApiKeyEncrypted!)).toBe("ghl-secret-value");
    expect(decryptSetupValue(protectedValues.metaCapiAccessTokenEncrypted!)).toBe("meta-token-value");
    expect(protectedValues.adminSessionSecretEncrypted).toBeUndefined();
  });

  it("reloads stored navigation and homepage sections in their exact saved order", () => {
    const defaults = defaultConfig();
    const navigationItems = [...defaults.navigationItems].reverse();
    const homepageSections = [...defaults.homepageSections].reverse();
    const stored = {
      id: 1,
      clientId: 1,
      socialLinks: defaults.socialLinks,
      fonts: defaults.brand.fonts,
      borderRadii: defaults.brand.borderRadii,
      navigationItems,
      categories: defaults.categories,
      financing: defaults.financing,
      homepageSections,
      integrations: defaults.integrations,
      generatedConfigEncrypted: null,
      generatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const reloaded = mergeStoredAstroConfig(defaults, stored);
    expect(reloaded.navigationItems.map(item => item.id)).toEqual(navigationItems.map(item => item.id));
    expect(reloaded.homepageSections.map(section => section.id)).toEqual(homepageSections.map(section => section.id));
  });
});
