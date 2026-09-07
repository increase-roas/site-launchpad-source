import { describe, expect, it } from "vitest";
import {
  ASTRO_CATEGORY_VALUES,
  ASTRO_SECTION_TYPE_VALUES,
  astroClientConfigInputSchema,
  astroHomepageSectionSchema,
  createAstroHomepageSection,
  createDefaultAstroConfig,
  generateAstroClientConfig,
  clientDeployGaps,
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
    const hero = config.homepageSections.find(section => section.type === "hero");
    expect(hero?.fields.ctaHref).toBe("/visit-us");
    expect(hero?.fields.ctaHref).not.toBe("/contact");
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
    config.integrations.ghl.enabled = true;
    config.integrations.meta.enabled = true;
    config.integrations.ghl.config = { webhookUrl: "https://legacy.example/secret" };
    config.integrations.meta.config = { pixelId: "123456789012345" };
    const parsed = astroClientConfigInputSchema.parse(config);
    expect(parsed.integrations.ghl.config).toEqual({});
    expect(parsed.integrations.meta.config).toEqual({});
  });

  it("supports every explicit section type and rejects incomplete enabled sections", () => {
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

  it("does not publish Launchpad local-asset URLs to the generated Worker config", () => {
    const config = createDefaultAstroConfig(client);
    const gallery = createAstroHomepageSection("gallery", "gallery-local");
    gallery.enabled = true;
    gallery.fields.heading = "Showroom";
    gallery.fields.images = JSON.stringify([
      { src: "/local-assets/clients/7-theme-matrix-qa/library/floor.webp", alt: "Floor", description: "" },
    ]);
    config.homepageSections = [
      ...config.homepageSections.filter(section => section.type !== "gallery"),
      gallery,
    ];
    const generated = generateAstroClientConfig(config, {
      navLogo: "/local-assets/clients/7-theme-matrix-qa/astro/navLogo.webp",
      footerLogo: "/local-assets/clients/7-theme-matrix-qa/astro/footerLogo.webp",
      favicon: "/local-assets/clients/7-theme-matrix-qa/astro/favicon.webp",
      ogImage: "/local-assets/clients/7-theme-matrix-qa/astro/ogImage.webp",
    });
    expect(generated).not.toContain("/local-assets/");
    expect(generated).toContain("/brand/logo-nav.svg");
    expect(generated).toContain("/brand/logo-footer.svg");
    expect(generated).toContain("/brand/favicon.svg");
  });

  it("rejects Astro hours that repeat a weekday", () => {
    const config = createDefaultAstroConfig(client);
    config.hours[1] = { ...config.hours[0] };
    expect(astroClientConfigInputSchema.safeParse(config).success).toBe(false);
  });

  it("lists the same gaps that keep deployMode off client", () => {
    const config = createDefaultAstroConfig(client);
    const assets = {
      navLogo: "https://assets.example.com/nav.webp",
      footerLogo: "https://assets.example.com/footer.webp",
      favicon: "https://assets.example.com/favicon.webp",
      ogImage: "https://assets.example.com/og.webp",
    };

    expect(clientDeployGaps(config, assets)).toEqual([
      "At least one product category",
    ]);
    expect(toCanonicalAstroClientConfig(config, assets).deployMode).toBe("template");

    config.categories["hot-tubs"] = {
      enabled: true,
      label: "Spas",
      slug: "hot-tubs",
      description: "Shop spas.",
      heroImage: "https://assets.example.com/hot-tubs.webp",
    };
    expect(clientDeployGaps(config, assets)).toEqual([]);
    expect(toCanonicalAstroClientConfig(config, assets).deployMode).toBe("client");

    config.identity.siteUrl = "http://insecure.example.com";
    config.address.latitude = "";
    expect(clientDeployGaps(config, { navLogo: "/logo.svg" })).toEqual([
      "HTTPS website address",
      "Map coordinates",
      "Site images: footerLogo, favicon, ogImage",
    ]);
  });

  it("rewrites dead template routes to pages that exist", () => {
    const config = createDefaultAstroConfig(client);
    config.categories["cold-plunge"] = {
      enabled: true,
      label: "Cold Plunges",
      slug: "cold-plunge",
      description: "Shop cold plunges.",
      heroImage: "https://assets.example.com/cold-plunges.webp",
    };
    config.navigationItems.push({
      id: "nav-plunge",
      type: "link",
      label: "Cold Plunges",
      href: "/cold-plunge",
      inHeader: true,
      inFooter: false,
    });
    const hero = config.homepageSections.find(section => section.type === "hero");
    if (hero) hero.fields.ctaHref = "/contact";

    const canonical = toCanonicalAstroClientConfig(config, {
      categoryColdPlunge: "https://assets.example.com/cold-plunges.webp",
    }) as {
      nav: { items: Array<{ type: string; href?: string }> };
      homepage: { sections: Array<{ actions?: Array<{ href: string }> }> };
    };

    expect(canonical.nav.items).toContainEqual({
      type: "link",
      label: "Cold Plunges",
      href: "/cold-plunges",
      inHeader: true,
      inFooter: false,
    });
    expect(canonical.nav.items.some(item => item.href === "/cold-plunge")).toBe(false);
    expect(canonical.homepage.sections[0]?.actions?.[0]?.href).toBe("/visit-us");
  });

  it("treats /cold-plunges as the enabled category route", () => {
    const config = createDefaultAstroConfig(client);
    config.categories["cold-plunge"] = {
      enabled: true,
      label: "Cold Plunges",
      slug: "cold-plunge",
      description: "Shop cold plunges.",
      heroImage: "https://assets.example.com/cold-plunges.webp",
    };
    config.navigationItems = [
      {
        id: "nav-plunge",
        type: "link",
        label: "Cold Plunges",
        href: "/cold-plunges",
        inHeader: true,
        inFooter: true,
      },
    ];

    const canonical = toCanonicalAstroClientConfig(config, {
      categoryColdPlunge: "https://assets.example.com/cold-plunges.webp",
    }) as { nav: { items: Array<{ href?: string }> } };

    expect(canonical.nav.items).toContainEqual({
      type: "link",
      label: "Cold Plunges",
      href: "/cold-plunges",
      inHeader: true,
      inFooter: true,
    });

    config.categories["cold-plunge"].enabled = false;
    const disabled = toCanonicalAstroClientConfig(config, {}) as {
      nav: { items: Array<{ href?: string }> };
    };
    expect(disabled.nav.items.some(item => item.href === "/cold-plunges")).toBe(false);
  });

  it("resolves gallery slides from the media library with per-image alt text", () => {
    const config = createDefaultAstroConfig(client);
    const gallery = createAstroHomepageSection("gallery", "gallery-1");
    gallery.enabled = true;
    gallery.fields.heading = "Showroom";
    gallery.fields.images = JSON.stringify([
      { id: 12, src: "https://old.example/stale.webp", alt: "Old", description: "" },
    ]);
    config.homepageSections = [
      ...config.homepageSections.filter(section => section.type !== "gallery"),
      gallery,
    ];
    const canonical = toCanonicalAstroClientConfig(config, {}, [
      {
        id: 12,
        storageUrl: "https://assets.example.com/fresh.webp",
        alt: "Showroom floor",
        description: "Main floor",
      },
    ]) as { homepage: { sections: Array<{ images?: Array<{ src: string; alt: string }> }> } };
    const published = canonical.homepage.sections.find(section => section.images);
    expect(published?.images).toEqual([
      { src: "https://assets.example.com/fresh.webp", alt: "Showroom floor" },
    ]);
  });

  it("publishes reviews, service areas, and the template homepage section types", () => {
    const config = createDefaultAstroConfig(client);
    config.serviceAreas = "Lakeside\nEl Cajon, Santee";
    const reviews = createAstroHomepageSection("reviews", "reviews-1");
    reviews.enabled = true;
    reviews.fields.heading = "Customer Reviews";
    reviews.fields.items = "Karen | Great team. | 5 | Google Review | July 2026";
    reviews.fields.aggregate = "4.7 | 48 | Google";
    const announcement = createAstroHomepageSection("announcement", "announce-1");
    announcement.enabled = true;
    announcement.fields.badge = "Evergreen Catalog";
    announcement.fields.text = "Shop hot tubs";
    announcement.fields.href = "/hot-tubs";
    const stats = createAstroHomepageSection("stats", "stats-1");
    stats.enabled = true;
    stats.fields.items = "5★ | Highly rated service\n100% | Out-the-door pricing";
    const comparison = createAstroHomepageSection("comparison", "compare-1");
    comparison.enabled = true;
    comparison.fields.heading = "Why Choose Us";
    comparison.fields.rows = "Pricing | Out-the-door price | Hidden fees later";
    const leadForm = createAstroHomepageSection("cta", "cta-1");
    leadForm.enabled = true;
    leadForm.fields.headline = "Get a price";
    leadForm.fields.ctaLabel = "Request pricing";
    config.homepageSections = [announcement, config.homepageSections[0]!, stats, reviews, comparison, leadForm];

    const canonical = toCanonicalAstroClientConfig(config, {}) as {
      serviceAreas: string[];
      homepage: { sections: Array<{ type: string; items?: unknown[]; heading?: string; buttonLabel?: string }> };
    };

    expect(canonical.serviceAreas).toEqual(["Lakeside", "El Cajon", "Santee"]);
    expect(canonical.homepage.sections.map(section => section.type)).toEqual([
      "announcement",
      "hero",
      "stats",
      "reviews",
      "comparison",
      "cta",
    ]);
    expect(canonical.homepage.sections.find(section => section.type === "reviews")).toMatchObject({
      heading: "Customer Reviews",
      items: [{ name: "Karen", quote: "Great team.", rating: 5, source: "Google Review", date: "July 2026" }],
      aggregate: { rating: 4.7, count: 48, source: "Google" },
    });
    expect(canonical.homepage.sections.find(section => section.type === "cta")).toEqual({
      type: "cta",
      heading: "Get a price",
      buttonLabel: "Request pricing",
      subtext: null,
    });
  });
});
