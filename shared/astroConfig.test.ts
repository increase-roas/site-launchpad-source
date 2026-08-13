import { describe, expect, it } from "vitest";
import {
  ASTRO_CATEGORY_VALUES,
  ASTRO_SECTION_TYPE_VALUES,
  astroClientConfigInputSchema,
  astroHomepageSectionSchema,
  createAstroHomepageSection,
  createDefaultAstroConfig,
  generateAstroClientConfig,
} from "./astroConfig";
import { BUSINESS_DAY_VALUES } from "./client";

const client = {
  businessName: "North Star Spas",
  shortName: "north-star",
  foundedYear: 1994,
  tagline: "Relax better at home",
  websiteUrl: "https://northstar.example.com",
  schemaType: "HomeAndConstructionBusiness" as const,
  phone: "+17015551234",
  smsPhone: "+17015551234",
  phoneDisplayOverride: "(701) 555-1234",
  email: "hello@northstar.example.com",
  streetAddress: "100 Main Street",
  street2: "Suite 2",
  city: "Minot",
  state: "ND",
  postalCode: "58701",
  country: "US",
  latitude: "48.2325",
  longitude: "-101.2963",
  googlePlaceId: "place-123",
  businessHours: BUSINESS_DAY_VALUES.map((day, index) => ({ day, isOpen: index < 5, opensAt: index < 5 ? "09:00" : "", closesAt: index < 5 ? "17:00" : "" })),
  facebookUrl: "https://facebook.com/northstar",
  theme: "mono" as const,
};

describe("Astro client config schema", () => {
  it("creates a valid complete default covering all top-level groups", () => {
    const config = createDefaultAstroConfig(client);
    const result = astroClientConfigInputSchema.safeParse(config);
    expect(
      result.success,
      result.success ? "" : JSON.stringify(result.error.issues, null, 2),
    ).toBe(true);
    expect(config.brand.theme).toBe("mono");
    expect(Object.keys(config.socialLinks)).toHaveLength(7);
    expect(Object.keys(config.integrations)).toHaveLength(6);
    expect(Object.keys(config.categories)).toEqual(ASTRO_CATEGORY_VALUES);
    expect(config.hours).toHaveLength(7);
  });

  it("validates E.164 SMS phones, coordinates, and optional social URLs", () => {
    const config = createDefaultAstroConfig(client);
    config.contact.smsPhone = "701-555-1234";
    config.address.latitude = "140";
    config.socialLinks.instagram = "instagram dot com";
    const result = astroClientConfigInputSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(issue => issue.path.join("."));
      expect(paths).toContain("contact.smsPhone");
      expect(paths).toContain("address.latitude");
      expect(paths).toContain("socialLinks.instagram");
    }
  });

  it("requires complete enabled categories including a hero image", () => {
    const config = createDefaultAstroConfig(client);
    config.categories["hot-tubs"] = { enabled: true, label: "Hot Tubs", slug: "hot-tubs", description: "Shop hot tubs", heroImage: "" };
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(false);
    config.categories["hot-tubs"].heroImage = "/manus-storage/category.webp";
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(true);
  });

  it("applies conditional financing and integration rules", () => {
    const config = createDefaultAstroConfig(client);
    config.financing.enabled = true;
    config.integrations.d1.enabled = true;
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(false);
    config.financing = { enabled: true, lenderName: "Example Lender", lenderUrl: "https://lender.example.com", disclaimer: "Subject to approval.", terms: "Terms apply.", ctaLabel: "Apply now", monthlyExample: "$99/month" };
    config.integrations.d1.config.binding = "DB";
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(true);
  });

  it("supports all ten explicit section types and rejects incomplete enabled sections", () => {
    for (const type of ASTRO_SECTION_TYPE_VALUES) {
      const section = createAstroHomepageSection(type, `test-${type}`);
      section.enabled = true;
      expect(astroHomepageSectionSchema.safeParse(section).success).toBe(false);
      for (const key of Object.keys(section.fields)) section.fields[key] = "Configured value";
      expect(astroHomepageSectionSchema.safeParse(section).success).toBe(true);
    }
  });

  it("generates deterministic TypeScript containing nested config and asset URLs", () => {
    const config = createDefaultAstroConfig(client);
    const assets = { navLogo: "/manus-storage/nav.webp", ogImage: "/manus-storage/og.webp" };
    const first = generateAstroClientConfig(config, assets);
    const second = generateAstroClientConfig(config, assets);
    expect(first).toBe(second);
    expect(first).toContain("export const clientConfig");
    expect(first).toContain("HomeAndConstructionBusiness");
    expect(first).toContain("/manus-storage/nav.webp");
  });
});
