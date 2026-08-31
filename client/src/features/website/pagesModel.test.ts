import { describe, expect, it } from "vitest";
import { BUSINESS_DAY_VALUES } from "@shared/client";
import {
  createDefaultAstroConfig,
  summarizeHomepageSections,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import {
  REQUIRED_ASSET_SLOTS,
  summarizeAstroConfigReadiness,
} from "@shared/astroConfigReadiness";
import {
  SITE_PAGE_IDS,
  buildSiteMap,
  buildSiteMapMetrics,
  pageStateLabel,
  pageStateTone,
  type PageRow,
  type SitePageId,
} from "./pagesModel";

const CLIENT_ID = 7;
const allAssets = REQUIRED_ASSET_SLOTS.map(slot => ({ slot }));

function baseConfig(): AstroClientConfigInput {
  return createDefaultAstroConfig({
    businessName: "Fargo Hot Tubs",
    shortName: "Fargo Tubs",
    foundedYear: 2011,
    tagline: "Relax in Fargo",
    websiteUrl: "https://fargohottubs.com",
    phone: "+17015551234",
    email: "hello@fargohottubs.com",
    streetAddress: "1420 Dakota Ave",
    city: "Fargo",
    state: "ND",
    postalCode: "58103",
    country: "US",
    businessHours: BUSINESS_DAY_VALUES.map(day => ({
      day,
      isOpen: true,
      opensAt: "09:00",
      closesAt: "17:00",
    })),
    facebookUrl: "",
    theme: "aqua",
  });
}

function siteMap(
  config: AstroClientConfigInput,
  options: { published?: boolean } = {},
): PageRow[] {
  return buildSiteMap({
    clientId: CLIENT_ID,
    config,
    readiness: summarizeAstroConfigReadiness(config, allAssets),
    published: options.published ?? false,
  });
}

function row(pages: readonly PageRow[], id: SitePageId): PageRow {
  const found = pages.find(page => page.id === id);
  if (!found) throw new Error(`Missing site map row: ${id}`);
  return found;
}

function enableCategory(config: AstroClientConfigInput): void {
  config.categories["hot-tubs"] = {
    enabled: true,
    label: "Hot Tubs",
    slug: "hot-tubs",
    description: "Shop hot tubs in Fargo.",
    heroImage: "https://assets.example.com/hot-tubs.webp",
  };
}

function enableFinancing(config: AstroClientConfigInput): void {
  config.financing = {
    enabled: true,
    lenderName: "Example Lender",
    lenderUrl: "https://lender.example.com",
    disclaimer: "Subject to approval.",
    terms: "Terms apply.",
    ctaLabel: "Apply now",
    monthlyExample: "$99/month",
  };
}

function enableProductData(config: AstroClientConfigInput): void {
  config.integrations.d1 = {
    enabled: true,
    config: { binding: "DB", databaseName: "fargo-hot-tubs" },
  };
  config.integrations.r2 = {
    enabled: true,
    config: { binding: "PRODUCT_IMAGES", bucketName: "fargo-hot-tubs" },
  };
}

describe("site map shape", () => {
  it("lists every template page group once, in build order", () => {
    const pages = siteMap(baseConfig());
    expect(pages.map(page => page.id)).toEqual([...SITE_PAGE_IDS]);
  });

  it("routes each page to the configuration surface that owns its content", () => {
    const pages = siteMap(baseConfig());
    expect(row(pages, "homepage").ownerHref).toBe(
      `/workspace/${CLIENT_ID}/configuration?tab=content`,
    );
    expect(row(pages, "categories").ownerHref).toBe(
      `/workspace/${CLIENT_ID}/configuration?tab=content`,
    );
    expect(row(pages, "financing").ownerHref).toBe(
      `/workspace/${CLIENT_ID}/configuration?tab=content`,
    );
    expect(row(pages, "visitUs").ownerHref).toBe(
      `/workspace/${CLIENT_ID}/configuration?tab=basic`,
    );
    expect(row(pages, "inventory").ownerHref).toBe(
      `/workspace/${CLIENT_ID}/configuration?tab=technical`,
    );
  });

  it("names the owning surface so the link target is never a guess", () => {
    const pages = siteMap(baseConfig());
    expect(row(pages, "homepage").ownerLabel).toBe("Homepage sections");
    expect(row(pages, "visitUs").ownerLabel).toBe("Business details");
  });
});

describe("homepage state", () => {
  it("counts the visible sections that will publish", () => {
    const homepage = row(siteMap(baseConfig()), "homepage");
    expect(homepage.state).toBe("ready");
    expect(homepage.detail).toBe("1 of 6 sections visible");
  });

  it("flags an empty homepage instead of calling it ready", () => {
    const config = baseConfig();
    for (const section of config.homepageSections) section.enabled = false;
    const homepage = row(siteMap(config), "homepage");
    expect(homepage.state).toBe("attention");
    expect(homepage.detail).toContain("No sections are visible");
  });

  it("flags a visible section that is missing copy", () => {
    const config = baseConfig();
    config.homepageSections[0].fields.headline = "";
    const homepage = row(siteMap(config), "homepage");
    expect(homepage.state).toBe("attention");
    expect(homepage.detail).toBe("1 field needs attention");
  });

  it("pluralizes outstanding fields", () => {
    const config = baseConfig();
    config.homepageSections[0].fields.headline = "";
    config.homepageSections[0].fields.ctaLabel = "";
    expect(row(siteMap(config), "homepage").detail).toBe("2 fields need attention");
  });
});

describe("category pages", () => {
  it("is off while no category is enabled", () => {
    const categories = row(siteMap(baseConfig()), "categories");
    expect(categories.state).toBe("off");
    expect(categories.detail).toContain("No categories are enabled");
  });

  it("becomes ready once an enabled category is complete", () => {
    const config = baseConfig();
    enableCategory(config);
    const categories = row(siteMap(config), "categories");
    expect(categories.state).toBe("ready");
    expect(categories.detail).toBe("1 of 5 categories enabled");
  });

  it("needs attention while an enabled category is incomplete", () => {
    const config = baseConfig();
    enableCategory(config);
    config.categories["hot-tubs"].description = "";
    expect(row(siteMap(config), "categories").state).toBe("attention");
  });
});

describe("financing page", () => {
  it("does not publish while financing is off", () => {
    const financing = row(siteMap(baseConfig()), "financing");
    expect(financing.state).toBe("off");
    expect(financing.detail).toContain("Financing is off");
  });

  it("is ready once lender details are complete", () => {
    const config = baseConfig();
    enableFinancing(config);
    expect(row(siteMap(config), "financing").state).toBe("ready");
  });

  it("needs attention while financing is on but unfinished", () => {
    const config = baseConfig();
    enableFinancing(config);
    config.financing.lenderName = "";
    expect(row(siteMap(config), "financing").state).toBe("attention");
  });
});

describe("inventory page", () => {
  it("cannot load products until the database and bucket are on", () => {
    const inventory = row(siteMap(baseConfig()), "inventory");
    expect(inventory.state).toBe("attention");
    expect(inventory.detail).toContain("D1 database");
  });

  it("is ready once product storage is configured", () => {
    const config = baseConfig();
    enableProductData(config);
    expect(row(siteMap(config), "inventory").state).toBe("ready");
  });
});

describe("visit us page", () => {
  it("is ready when the business details it renders are complete", () => {
    expect(row(siteMap(baseConfig()), "visitUs").state).toBe("ready");
  });

  it("needs attention when a business detail is missing", () => {
    const config = baseConfig();
    config.address.postalCode = "";
    expect(row(siteMap(config), "visitUs").state).toBe("attention");
  });
});

describe("publish state", () => {
  it("promotes ready pages to live only after the site is published", () => {
    const config = baseConfig();
    enableCategory(config);
    enableFinancing(config);
    enableProductData(config);

    expect(siteMap(config).map(page => page.state)).toEqual([
      "ready",
      "ready",
      "ready",
      "ready",
      "ready",
    ]);
    expect(siteMap(config, { published: true }).map(page => page.state)).toEqual([
      "live",
      "live",
      "live",
      "live",
      "live",
    ]);
  });

  it("leaves unfinished and disabled pages alone when the site is published", () => {
    const pages = siteMap(baseConfig(), { published: true });
    expect(row(pages, "categories").state).toBe("off");
    expect(row(pages, "inventory").state).toBe("attention");
  });
});

describe("site map metrics", () => {
  it("summarizes states and measures readiness against publishable pages", () => {
    const config = baseConfig();
    enableProductData(config);
    const metrics = buildSiteMapMetrics(siteMap(config));

    expect(metrics.total).toBe(5);
    expect(metrics.ready).toBe(3);
    expect(metrics.live).toBe(0);
    expect(metrics.attention).toBe(0);
    expect(metrics.off).toBe(2);
    expect(metrics.publishable).toBe(3);
    expect(metrics.readyPercent).toBe(100);
  });

  it("counts a live site and reports partial readiness", () => {
    const metrics = buildSiteMapMetrics(siteMap(baseConfig(), { published: true }));

    expect(metrics.live).toBe(2);
    expect(metrics.attention).toBe(1);
    expect(metrics.off).toBe(2);
    expect(metrics.publishable).toBe(3);
    expect(metrics.readyPercent).toBe(67);
  });

  it("reports zero instead of dividing by no publishable pages", () => {
    expect(buildSiteMapMetrics([]).readyPercent).toBe(0);
  });
});

describe("state presentation", () => {
  it("labels and tones each state distinctly", () => {
    expect(pageStateLabel("live")).toBe("Live");
    expect(pageStateLabel("ready")).toBe("Ready");
    expect(pageStateLabel("attention")).toBe("Needs attention");
    expect(pageStateLabel("off")).toBe("Off");

    expect(pageStateTone("live")).toBe("success");
    expect(pageStateTone("ready")).toBe("primary");
    expect(pageStateTone("attention")).toBe("warning");
    expect(pageStateTone("off")).toBe("neutral");
  });
});

describe("homepage section summary", () => {
  it("counts enabled sections out of the configured total", () => {
    expect(summarizeHomepageSections(baseConfig().homepageSections)).toEqual({
      enabled: 1,
      total: 6,
    });
    expect(summarizeHomepageSections([])).toEqual({ enabled: 0, total: 0 });
  });
});
