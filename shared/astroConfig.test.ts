import { describe, expect, it } from "vitest";
import {
  ASTRO_CATEGORY_VALUES,
  ASTRO_SECTION_TYPE_VALUES,
  astroClientConfigInputSchema,
  astroHomepageSectionSchema,
  createAstroHomepageSection,
  createDefaultAstroConfig,
  generateAstroClientConfig,
  toCanonicalAstroClientConfig,
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
    config.categories["hot-tubs"].heroImage = "https://assets.example.com/category.webp";
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

  it("maps dashboard fields to the canonical Astro ClientConfigInput shape", () => {
    const config = createDefaultAstroConfig(client);
    config.categories["hot-tubs"] = {
      enabled: true,
      label: "Spas",
      slug: "hot-tubs",
      description: "Shop our current spas.",
      heroImage: "https://assets.example.com/hot-tubs.webp",
    };
    config.integrations.ghl.enabled = true;
    config.integrations.ghl.config.locationId = "location-123";
    config.financing = {
      enabled: true,
      lenderName: "Example Lender",
      lenderUrl: "https://lender.example.com/apply",
      disclaimer: "Subject to credit approval.",
      terms: "Approved terms vary.",
      ctaLabel: "See financing options",
      monthlyExample: "Flexible monthly options are available.",
    };
    const assets = {
      navLogo: "https://assets.example.com/nav.webp",
      footerLogo: "https://assets.example.com/footer.webp",
      inventoryLogo: "https://assets.example.com/inventory.webp",
      favicon: "https://assets.example.com/favicon.webp",
      ogImage: "https://assets.example.com/og.webp",
      categoryHotTubs: "https://assets.example.com/hot-tubs.webp",
    };

    const canonical = toCanonicalAstroClientConfig(config, assets) as any;
    expect(canonical).toMatchObject({
      deployMode: "client",
      identity: {
        name: "North Star Spas",
        shortName: "north-star",
        foundedYear: 1994,
        tagline: "Relax better at home",
        siteUrl: "https://northstar.example.com",
        schemaType: "HomeAndConstructionBusiness",
      },
      contact: {
        phone: "+17015551234",
        phoneDisplayOverride: "(701) 555-1234",
        smsPhone: "+17015551234",
        email: "hello@northstar.example.com",
      },
      address: {
        street: "100 Main Street",
        street2: "Suite 2",
        city: "Minot",
        region: "ND",
        postalCode: "58701",
        country: "US",
        latitude: 48.2325,
        longitude: -101.2963,
        googlePlaceId: "place-123",
      },
      brand: {
        fonts: {
          display: "Manrope",
          body: "Manrope",
          mono: "JetBrains Mono",
          googleFontsHref: expect.stringContaining("fonts.googleapis.com"),
        },
        logos: {
          nav: assets.navLogo,
          footer: assets.footerLogo,
          inventory: assets.inventoryLogo,
          favicon: assets.favicon,
          ogImage: assets.ogImage,
        },
        radius: { card: 24, button: 12, pill: 999 },
      },
      categories: {
        "hot-tub": {
          enabled: true,
          label: "Spas",
          blurb: "Shop our current spas.",
          heroImage: assets.categoryHotTubs,
          sortOrder: 0,
        },
      },
      financing: {
        headline: "See financing options",
        blurb: "Flexible monthly options are available.",
        bullets: ["Approved terms vary."],
        lenderName: "Example Lender",
        applyUrl: "https://lender.example.com/apply",
        disclaimer: "Subject to credit approval.",
      },
      integrations: {
        d1BindingName: "DB",
        r2BindingName: "PRODUCT_IMAGES",
        ghl: { enabled: true },
        meta: { enabled: false },
        zaraz: { enabled: false },
        sentry: { enabled: false },
      },
    });
    expect(canonical.hours).toEqual(
      BUSINESS_DAY_VALUES.slice(0, 5).map(day => ({
        days: [day[0]!.toUpperCase() + day.slice(1)],
        opens: "09:00",
        closes: "17:00",
      })),
    );
    expect(canonical.social.facebook).toBe("https://facebook.com/northstar");
    expect(canonical).not.toHaveProperty("navigationItems");
    expect(canonical).not.toHaveProperty("homepageSections");
    expect(canonical.brand).not.toHaveProperty("theme");
  });

  it("generates deterministic canonical TypeScript with the exact export", () => {
    const config = createDefaultAstroConfig(client);
    const assets = {
      navLogo: "https://assets.example.com/nav.webp",
      footerLogo: "https://assets.example.com/footer.webp",
      favicon: "https://assets.example.com/favicon.webp",
      ogImage: "https://assets.example.com/og.webp",
    };
    const first = generateAstroClientConfig(config, assets);
    const second = generateAstroClientConfig(config, assets);
    expect(first).toBe(second);
    expect(first).toContain('import type { ClientConfigInput } from "./schema";');
    expect(first).toContain("export const rawClientConfig: ClientConfigInput = {");
    expect(first).not.toContain("export const clientConfig");
    expect(first).toContain("HomeAndConstructionBusiness");
    expect(first).toContain("https://assets.example.com/nav.webp");
    expect(first).toContain('"d1BindingName": "DB"');
    expect(first).toContain('"r2BindingName": "PRODUCT_IMAGES"');
  });

  it("rejects Astro hours that repeat a weekday", () => {
    const config = createDefaultAstroConfig(client);
    config.hours[1] = { ...config.hours[0] };
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(false);
  });
});
