import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyAstroAssetUrls,
  mergeStoredAstroConfig,
  protectWranglerSecretValues,
  resolveProductCategories,
} from "./astroConfigDb";
import { decryptSetupValue } from "./clientSecurity";
import { createDefaultAstroConfig } from "../shared/astroConfig";
import { BUSINESS_DAY_VALUES } from "../shared/client";

const originalSecret = process.env.JWT_SECRET;

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
  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-astro-config-encryption-secret";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });
  it("merges every persisted category hero asset into saved category data", () => {
    const config = defaultConfig();
    const merged = applyAstroAssetUrls(config, {
      categoryHotTubs: "https://assets.example.com/hot-tubs.webp",
      categorySwimSpas: "https://assets.example.com/swim-spas.webp",
      categorySaunas: "https://assets.example.com/saunas.webp",
      categoryColdPlunge: "https://assets.example.com/cold-plunge.webp",
      categoryMassageChairs: "https://assets.example.com/massage-chairs.webp",
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
      integrations: {
        ...defaults.integrations,
        ghl: {
          enabled: true,
          config: { webhookUrl: "https://legacy.example/secret-webhook" },
        },
        meta: { enabled: true, config: { pixelId: "123456789012345" } },
      },
      generatedConfigEncrypted: null,
      generatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const reloaded = mergeStoredAstroConfig(defaults, stored);
    expect(reloaded.navigationItems.map(item => item.id)).toEqual(navigationItems.map(item => item.id));
    expect(reloaded.homepageSections.map(section => section.id)).toEqual(homepageSections.map(section => section.id));
    expect(reloaded.integrations.ghl.config).toEqual({});
    expect(reloaded.integrations.meta.config).toEqual({});
    expect(JSON.stringify(reloaded)).not.toContain("secret-webhook");
  });

  it("keeps existing launch categories when the first Settings save has none enabled", () => {
    const config = defaultConfig();
    for (const category of Object.keys(config.categories) as Array<keyof typeof config.categories>) {
      config.categories[category].enabled = false;
    }
    expect(resolveProductCategories(config, ["hotTubs", "saunas"])).toEqual(["hotTubs", "saunas"]);
    config.categories["hot-tubs"].enabled = true;
    expect(resolveProductCategories(config, ["saunas"])).toEqual(["hotTubs"]);
  });
});
