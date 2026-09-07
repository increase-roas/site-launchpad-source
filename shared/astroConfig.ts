import { z } from "zod";
import { BUSINESS_DAY_VALUES, businessHourSchema } from "./client";
import { siteFontStylesheetHref } from "./astroFontCatalog";
import { resolveGalleryImages, type MediaLibraryItemRef } from "./mediaLibrary";
import { isPublicDeployAssetUrl } from "./publishedMedia";

const DEFAULT_FONTS = { display: "Manrope", body: "Manrope", mono: "JetBrains Mono" } as const;

export const ASTRO_SCHEMA_TYPE_VALUES = [
  "HomeAndConstructionBusiness",
  "Store",
  "LocalBusiness",
] as const;
export const ASTRO_THEME_VALUES = ["aqua", "luxury", "natural", "mono"] as const;
export const ASTRO_CATEGORY_VALUES = [
  "hot-tubs",
  "swim-spas",
  "saunas",
  "cold-plunge",
  "massage-chairs",
] as const;
export const ASTRO_SECTION_TYPE_VALUES = [
  "announcement",
  "hero",
  "stats",
  "offercard",
  "products",
  "categoryrow",
  "cards",
  "imagecards",
  "benefits",
  "gallery",
  "reviews",
  "comparison",
  "promise",
  "visit",
  "splitcards",
  "steps",
  "faq",
  "ctaband",
  "cta",
  "trust",
  "bignumber",
  "countdown",
] as const;
export const ASTRO_INTEGRATION_VALUES = ["d1", "r2", "ghl", "meta", "zaraz", "sentry"] as const;
export const ASTRO_ASSET_SLOT_VALUES = [
  "navLogo",
  "footerLogo",
  "inventoryLogo",
  "favicon",
  "ogImage",
  "categoryHotTubs",
  "categorySwimSpas",
  "categorySaunas",
  "categoryColdPlunge",
  "categoryMassageChairs",
] as const;

export type AstroAssetSlot = (typeof ASTRO_ASSET_SLOT_VALUES)[number];
export type AstroSectionType = (typeof ASTRO_SECTION_TYPE_VALUES)[number];
export type AstroCategory = (typeof ASTRO_CATEGORY_VALUES)[number];
export type AstroIntegration = (typeof ASTRO_INTEGRATION_VALUES)[number];

export const ASTRO_SECTION_LABELS: Record<AstroSectionType, string> = {
  announcement: "Announcement bar",
  hero: "Hero",
  stats: "Stats row",
  offercard: "Offer card",
  products: "Showroom products",
  categoryrow: "Category row",
  cards: "Product cards",
  imagecards: "Image cards",
  benefits: "Benefits",
  gallery: "Gallery",
  reviews: "Reviews",
  comparison: "Comparison table",
  promise: "Promise band",
  visit: "Visit showroom",
  splitcards: "Split cards",
  steps: "How it works",
  faq: "FAQ",
  ctaband: "Call-to-action band",
  cta: "Lead form",
  trust: "Trust strip",
  bignumber: "Featured number",
  countdown: "Countdown",
};

export const ASTRO_SECTION_DESCRIPTIONS: Record<AstroSectionType, string> = {
  announcement: "Thin bar above the homepage for a catalog or promotion.",
  hero: "Main headline, supporting copy, lead card, and primary actions.",
  stats: "A row of proof numbers.",
  offercard: "A raised card making one offer with bullets and buttons.",
  products: "Live inventory from the product database.",
  categoryrow: "Cards built from the categories this client sells.",
  cards: "Product or service cards customers can browse.",
  imagecards: "Image tiles with overlay text and links.",
  benefits: "A short list of outcomes or reasons to buy.",
  gallery: "Approved website imagery.",
  reviews: "Customer quotes and an optional aggregate rating.",
  comparison: "A you-versus-everyone-else table.",
  promise: "Badge plus a checklist of local promises.",
  visit: "Showroom information and a reason to visit.",
  splitcards: "Two side-by-side photo cards with their own buttons.",
  steps: "A short sequence explaining what happens next.",
  faq: "Common customer questions and answers.",
  ctaband: "A compact conversion prompt between sections.",
  cta: "The shared lead form as its own section.",
  trust: "A short strip of trust signals.",
  bignumber: "One prominent proof point or business statistic.",
  countdown: "A timed offer or event deadline.",
};

export const ASTRO_ASSET_LABELS: Record<AstroAssetSlot, string> = {
  navLogo: "Navigation logo",
  footerLogo: "Footer logo",
  inventoryLogo: "Inventory logo",
  favicon: "Favicon",
  ogImage: "Social share image",
  categoryHotTubs: "Hot tubs hero",
  categorySwimSpas: "Swim spas hero",
  categorySaunas: "Saunas hero",
  categoryColdPlunge: "Cold plunge hero",
  categoryMassageChairs: "Massage chairs hero",
};

export const ASTRO_ASSET_FILENAMES: Record<AstroAssetSlot, string> = {
  navLogo: "logo-nav.webp",
  footerLogo: "logo-footer.webp",
  inventoryLogo: "logo-inventory.webp",
  favicon: "favicon.webp",
  ogImage: "og-image.webp",
  categoryHotTubs: "category-hot-tubs-hero.webp",
  categorySwimSpas: "category-swim-spas-hero.webp",
  categorySaunas: "category-saunas-hero.webp",
  categoryColdPlunge: "category-cold-plunge-hero.webp",
  categoryMassageChairs: "category-massage-chairs-hero.webp",
};

export const WRANGLER_SECRET_VALUES = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "STAGE_WEBHOOK_SECRET",
  "GOOGLE_SHEETS_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "ALERT_WEBHOOK_URL",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
] as const;
export type WranglerSecretName = (typeof WRANGLER_SECRET_VALUES)[number];

export const WRANGLER_SECRET_DESCRIPTIONS: Record<WranglerSecretName, string> = {
  GHL_API_KEY: "GoHighLevel private integration key",
  GHL_LOCATION_ID: "GoHighLevel client location ID",
  META_PIXEL_ID: "Meta browser tracking pixel ID",
  META_CAPI_ACCESS_TOKEN: "Meta server-side tracking token",
  STAGE_WEBHOOK_SECRET: "Shared secret for stage-change webhooks",
  GOOGLE_SHEETS_ID: "Destination Google Sheet ID (share the sheet with the service account below)",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "Google service-account email that has Editor access to the destination sheet",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "Google service-account private key",
  ALERT_WEBHOOK_URL: "Webhook that receives site alerts",
  ADMIN_PASSWORD: "Password for the site admin area",
  ADMIN_SESSION_SECRET: "Secret used to sign admin sessions",
};

const optionalHttpUrl = z.string().trim().max(1200).refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Enter a complete web address.");
const requiredHttpUrl = optionalHttpUrl.refine(Boolean, "Enter the website address.");
const optionalE164 = z.string().trim().max(24).refine(value => !value || /^\+[1-9]\d{7,14}$/.test(value), "Use E.164 format, such as +17015551234.");
const coordinate = (minimum: number, maximum: number) =>
  z.string().trim().refine(value => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum;
  }, `Enter a number from ${minimum} to ${maximum}.`);
const slug = z.string().trim().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const astroNavigationItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["categories", "link"]),
    label: z.string().trim().max(120),
    href: z.string().trim().max(500),
    inHeader: z.boolean(),
    inFooter: z.boolean(),
  })
  .superRefine((item, context) => {
    if (item.type === "link" && !item.label) context.addIssue({ code: "custom", path: ["label"], message: "Enter a label." });
    if (item.type === "link" && !item.href) context.addIssue({ code: "custom", path: ["href"], message: "Enter a link." });
  });

export const astroCategorySchema = z
  .object({
    enabled: z.boolean(),
    label: z.string().trim().max(120),
    slug: z.string().trim().max(120),
    description: z.string().trim().max(2000),
    heroImage: z.string().trim().max(1200),
  })
  .superRefine((category, context) => {
    if (!category.enabled) return;
    if (!category.label) context.addIssue({ code: "custom", path: ["label"], message: "Enter a label." });
    if (!category.slug || !slug.safeParse(category.slug).success) context.addIssue({ code: "custom", path: ["slug"], message: "Enter a valid slug." });
    if (!category.description) context.addIssue({ code: "custom", path: ["description"], message: "Enter a description." });
    if (!category.heroImage) context.addIssue({ code: "custom", path: ["heroImage"], message: "Upload a category hero image." });
  });

export const astroFinancingSchema = z
  .object({
    enabled: z.boolean(),
    lenderName: z.string().trim().max(160),
    lenderUrl: optionalHttpUrl,
    disclaimer: z.string().trim().max(5000),
    terms: z.string().trim().max(5000),
    ctaLabel: z.string().trim().max(120),
    monthlyExample: z.string().trim().max(500),
  })
  .superRefine((financing, context) => {
    if (!financing.enabled) return;
    for (const field of ["lenderName", "lenderUrl", "disclaimer", "terms", "ctaLabel", "monthlyExample"] as const) {
      if (!financing[field]) context.addIssue({ code: "custom", path: [field], message: "Complete this financing field." });
    }
  });

const SECTION_REQUIRED_FIELDS: Record<AstroSectionType, string[]> = {
  announcement: ["text"],
  hero: ["headline", "subheadline", "ctaLabel", "ctaHref"],
  stats: ["items"],
  offercard: ["heading"],
  products: ["heading"],
  categoryrow: ["heading"],
  cards: ["heading", "items"],
  imagecards: ["heading", "items"],
  benefits: ["items"],
  visit: ["heading", "body", "ctaLabel", "ctaHref"],
  splitcards: ["items"],
  steps: ["heading", "steps"],
  gallery: ["heading", "images"],
  reviews: ["heading", "items"],
  comparison: ["heading", "rows"],
  promise: ["heading", "bullets"],
  bignumber: ["value", "label"],
  faq: ["heading", "items"],
  ctaband: ["headline", "ctaLabel", "ctaHref"],
  cta: ["headline", "ctaLabel"],
  trust: ["items"],
  countdown: ["heading", "endsAt"],
};

export const astroHomepageSectionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(ASTRO_SECTION_TYPE_VALUES),
    enabled: z.boolean(),
    fields: z.record(z.string(), z.string().max(8000)),
  })
  .superRefine((section, context) => {
    if (!section.enabled) return;
    for (const field of SECTION_REQUIRED_FIELDS[section.type]) {
      if (!section.fields[field]?.trim()) {
        context.addIssue({ code: "custom", path: ["fields", field], message: "Complete this section field." });
      }
    }
  });

export const astroIntegrationSchema = z
  .object({ enabled: z.boolean(), config: z.record(z.string(), z.string().max(2000)) })
  .superRefine((integration, context) => {
    if (integration.enabled && !Object.values(integration.config).some(value => value.trim())) {
      context.addIssue({ code: "custom", path: ["config"], message: "Complete at least one setup field." });
    }
  });

const profileBackedAstroIntegrationSchema = z.object({
  enabled: z.boolean(),
  // Historical rows stored GHL/Meta identifiers and even webhook values here.
  // The canonical client profile owns them now, so parsing always strips them.
  config: z.record(z.string(), z.string().max(2000)).transform(() => ({})),
});

export const astroClientConfigInputSchema = z.object({
  identity: z.object({
    businessName: z.string().trim().min(2).max(160),
    shortName: z.string().trim().min(2).max(80),
    foundedYear: z.number().int().min(1800).max(new Date().getFullYear()),
    tagline: z.string().trim().min(2).max(240),
    siteUrl: requiredHttpUrl,
    schemaType: z.enum(ASTRO_SCHEMA_TYPE_VALUES),
  }),
  contact: z.object({
    phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format."),
    smsPhone: optionalE164,
    phoneDisplayOverride: z.string().trim().max(80),
    email: z.string().trim().email().max(320),
  }),
  address: z.object({
    street1: z.string().trim().min(2).max(240),
    street2: z.string().trim().max(240),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(120),
    postalCode: z.string().trim().min(2).max(24),
    country: z.string().trim().min(2).max(120).default("US"),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
    googlePlaceId: z.string().trim().max(300),
  }),
  hours: z
    .array(businessHourSchema)
    .length(7, "Set hours for every day.")
    .superRefine((hours, context) => {
      const days = new Set(hours.map(hour => hour.day));
      if (days.size !== BUSINESS_DAY_VALUES.length) {
        context.addIssue({ code: "custom", message: "Set hours for every day." });
      }
    }),
  socialLinks: z.object({
    facebook: optionalHttpUrl,
    instagram: optionalHttpUrl,
    youtube: optionalHttpUrl,
    tiktok: optionalHttpUrl,
    x: optionalHttpUrl,
    linkedin: optionalHttpUrl,
    googleBusiness: optionalHttpUrl,
  }),
  brand: z.object({
    theme: z.enum(ASTRO_THEME_VALUES),
    fonts: z.object({ display: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(120), mono: z.string().trim().min(1).max(120), googleFontsUrl: optionalHttpUrl }),
  }),
  navigationItems: z.array(astroNavigationItemSchema).max(30),
  categories: z.record(z.enum(ASTRO_CATEGORY_VALUES), astroCategorySchema),
  financing: astroFinancingSchema,
  serviceAreas: z.string().trim().max(2000).default(""),
  homepageSections: z.array(astroHomepageSectionSchema).max(40),
  integrations: z.object({
    d1: astroIntegrationSchema,
    r2: astroIntegrationSchema,
    ghl: profileBackedAstroIntegrationSchema,
    meta: profileBackedAstroIntegrationSchema,
    zaraz: astroIntegrationSchema,
    sentry: astroIntegrationSchema,
  }),
});

export type AstroClientConfigInput = z.infer<typeof astroClientConfigInputSchema>;
export type AstroNavigationItem = z.infer<typeof astroNavigationItemSchema>;
export type AstroHomepageSection = z.infer<typeof astroHomepageSectionSchema>;

const sectionFields: Record<AstroSectionType, Record<string, string>> = {
  announcement: { badge: "", text: "", href: "" },
  hero: {
    eyebrow: "",
    headline: "",
    subheadline: "",
    highlight: "",
    promo: "",
    bullets: "",
    backgroundImage: "",
    ctaLabel: "",
    ctaHref: "",
    ctaLabel2: "",
    ctaHref2: "",
    leadHeading: "",
    leadSubtext: "",
    leadFootnote: "",
  },
  stats: { items: "" },
  offercard: { eyebrow: "", heading: "", body: "", bullets: "", ctaLabel: "", ctaHref: "", ctaLabel2: "", ctaHref2: "" },
  products: { eyebrow: "", heading: "", body: "", limit: "4", category: "", moreLabel: "", moreHref: "", disclaimer: "" },
  categoryrow: { eyebrow: "", heading: "", body: "" },
  cards: { heading: "", intro: "", items: "" },
  imagecards: { eyebrow: "", heading: "", items: "" },
  benefits: { heading: "", items: "" },
  visit: { heading: "", body: "", ctaLabel: "", ctaHref: "" },
  splitcards: { eyebrow: "", heading: "", items: "" },
  steps: { eyebrow: "", heading: "", steps: "" },
  gallery: { heading: "", images: "" },
  reviews: { eyebrow: "", heading: "", items: "", aggregate: "" },
  comparison: { eyebrow: "", heading: "", body: "", themLabel: "", rows: "" },
  promise: { badgeValue: "", badgeLabel: "", heading: "", body: "", bullets: "" },
  bignumber: { value: "", label: "", body: "" },
  faq: { eyebrow: "", heading: "", items: "" },
  ctaband: { eyebrow: "", headline: "", subheadline: "", ctaLabel: "", ctaHref: "", ctaLabel2: "", ctaHref2: "", footnote: "" },
  cta: { headline: "", ctaLabel: "", subtext: "" },
  trust: { items: "" },
  countdown: { eyebrow: "", heading: "", body: "", endsAt: "" },
};

export const ASTRO_SECTION_FIELD_LABELS: Record<AstroSectionType, Record<string, string>> = Object.fromEntries(
  Object.entries(sectionFields).map(([type, fields]) => [
    type,
    Object.fromEntries(Object.keys(fields).map(key => [key, key.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase())])),
  ]),
) as Record<AstroSectionType, Record<string, string>>;

export function createAstroHomepageSection(
  type: AstroSectionType,
  id = `section-${type}-${Date.now()}`,
): AstroHomepageSection {
  return { id, type, enabled: false, fields: { ...sectionFields[type] } };
}

/**
 * The one place homepage composition is counted. Readiness on Pages, Overview,
 * and Launch all read this so they cannot disagree about what publishes.
 */
export function summarizeHomepageSections(
  sections: readonly AstroHomepageSection[],
): { enabled: number; total: number } {
  return {
    enabled: sections.filter(section => section.enabled).length,
    total: sections.length,
  };
}

export const ASTRO_INTEGRATION_FIELDS: Record<AstroIntegration, Record<string, string>> = {
  d1: { binding: "Binding name", databaseName: "Database name" },
  r2: { binding: "Binding name", bucketName: "Bucket name" },
  ghl: {},
  meta: {},
  zaraz: { endpoint: "Zaraz endpoint", debug: "Debug mode" },
  sentry: { dsn: "Sentry DSN", environment: "Environment" },
};

export function createDefaultAstroConfig(client: {
  businessName: string;
  shortName: string;
  foundedYear: number;
  tagline: string;
  websiteUrl: string;
  schemaType?: (typeof ASTRO_SCHEMA_TYPE_VALUES)[number];
  phone: string;
  smsPhone?: string | null;
  phoneDisplayOverride?: string | null;
  email: string;
  streetAddress: string;
  street2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: string | null;
  longitude?: string | null;
  googlePlaceId?: string | null;
  businessHours: Array<{ day: (typeof BUSINESS_DAY_VALUES)[number]; isOpen: boolean; opensAt: string; closesAt: string }>;
  facebookUrl: string;
  theme: (typeof ASTRO_THEME_VALUES)[number];
}): AstroClientConfigInput {
  const categories = Object.fromEntries(ASTRO_CATEGORY_VALUES.map(value => [value, {
    enabled: false,
    label: value.split("-").map(part => part[0]!.toUpperCase() + part.slice(1)).join(" "),
    slug: value,
    description: "",
    heroImage: "",
  }])) as AstroClientConfigInput["categories"];
  const integrations = Object.fromEntries(ASTRO_INTEGRATION_VALUES.map(value => [value, {
    enabled: false,
    config: Object.fromEntries(Object.keys(ASTRO_INTEGRATION_FIELDS[value]).map(key => [key, ""])),
  }])) as AstroClientConfigInput["integrations"];

  return {
    identity: { businessName: client.businessName, shortName: client.shortName, foundedYear: client.foundedYear, tagline: client.tagline, siteUrl: client.websiteUrl, schemaType: client.schemaType ?? "HomeAndConstructionBusiness" },
    contact: { phone: client.phone, smsPhone: client.smsPhone ?? "", phoneDisplayOverride: client.phoneDisplayOverride ?? "", email: client.email },
    address: { street1: client.streetAddress, street2: client.street2 ?? "", city: client.city, state: client.state, postalCode: client.postalCode, country: client.country || "US", latitude: client.latitude ?? "", longitude: client.longitude ?? "", googlePlaceId: client.googlePlaceId ?? "" },
    hours: client.businessHours,
    socialLinks: { facebook: client.facebookUrl, instagram: "", youtube: "", tiktok: "", x: "", linkedin: "", googleBusiness: "" },
    brand: { theme: client.theme, fonts: { ...DEFAULT_FONTS, googleFontsUrl: siteFontStylesheetHref(DEFAULT_FONTS) } },
    navigationItems: [
      { id: "nav-categories", type: "categories", label: "Products", href: "", inHeader: true, inFooter: true },
      { id: "nav-visit", type: "link", label: "Visit Us", href: "/visit-us", inHeader: true, inFooter: true },
      { id: "nav-financing", type: "link", label: "Financing", href: "/financing", inHeader: true, inFooter: true },
    ],
    categories,
    financing: { enabled: false, lenderName: "", lenderUrl: "", disclaimer: "", terms: "", ctaLabel: "Apply for financing", monthlyExample: "" },
    serviceAreas: "",
    homepageSections: ["hero", "cards", "visit", "gallery", "faq", "cta"].map((type, index) => {
      const section = createAstroHomepageSection(type as AstroSectionType, `section-${type}-${index}`);
      return type === "hero"
        ? {
            ...section,
            enabled: true,
            fields: {
              ...section.fields,
              headline: client.businessName,
              subheadline: client.tagline,
              ctaLabel: "Contact us",
              ctaHref: "/visit-us",
            },
          }
        : section;
    }),
    integrations,
  };
}

const CANONICAL_DAY_NAMES: Record<(typeof BUSINESS_DAY_VALUES)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const CANONICAL_CATEGORY_KEYS: Record<AstroCategory, string> = {
  "hot-tubs": "hot-tub",
  "swim-spas": "swim-spa",
  saunas: "sauna",
  "cold-plunge": "cold-plunge",
  "massage-chairs": "massage-chair",
};

/** Template URL segments. Cold plunge is plural on the live site. */
const CANONICAL_CATEGORY_HREFS: Record<string, string> = {
  "hot-tub": "/hot-tubs",
  "swim-spa": "/swim-spas",
  "sauna": "/saunas",
  "cold-plunge": "/cold-plunges",
  "massage-chair": "/massage-chairs",
};

const CANONICAL_CATEGORY_ROUTES: Record<string, string> = {
  "/hot-tubs": "hot-tub",
  "/swim-spas": "swim-spa",
  "/saunas": "sauna",
  "/cold-plunge": "cold-plunge",
  "/cold-plunges": "cold-plunge",
  "/massage-chairs": "massage-chair",
};

const DEAD_TEMPLATE_HREFS: Record<string, string> = {
  "/contact": "/visit-us",
  "/cold-plunge": "/cold-plunges",
};

function rewriteTemplateHref(href: string): string {
  const normalized = href.replace(/\/$/, "") || href;
  return DEAD_TEMPLATE_HREFS[normalized] ?? href;
}

const CATEGORY_ASSET_SLOTS: Record<AstroCategory, AstroAssetSlot> = {
  "hot-tubs": "categoryHotTubs",
  "swim-spas": "categorySwimSpas",
  saunas: "categorySaunas",
  "cold-plunge": "categoryColdPlunge",
  "massage-chairs": "categoryMassageChairs",
};

/**
 * Corner rounding is fixed rather than client-configurable. The template still
 * requires `brand.radius`, and caps card and button at 48px.
 */
const CANONICAL_BRAND_RADIUS = { card: 24, button: 12, pill: 999 };

const BASE_CANONICAL_COLORS = {
  primary: "#16469B",
  primaryMid: "#0F327A",
  deep: "#0B2559",
  night: "#06183D",
  abyss: "#030C20",
  accent: "#FFB81C",
  accentSoft: "#FFCB57",
  accentDeep: "#E8A400",
  accentDark: "#8F6400",
  accentLift: "#FFD46A",
  accentPress: "#F0A400",
  accentGlow: "#FFE29A",
  urgent: "#D7261E",
  urgentLight: "#E8382F",
  urgentDark: "#B71E17",
  surface: "#FFFFFF",
  surfaceAlt: "#F8F4EC",
  ink: "#141927",
  inkMuted: "#4A5268",
  onDark: "#C6D4EF",
  onDarkMuted: "#8FA6D2",
};

const THEME_COLOR_OVERRIDES: Record<
  (typeof ASTRO_THEME_VALUES)[number],
  Partial<typeof BASE_CANONICAL_COLORS>
> = {
  luxury: {},
  aqua: {
    primary: "#087F8C",
    primaryMid: "#066875",
    deep: "#064F5B",
    night: "#043A43",
    abyss: "#02272E",
    accent: "#45D6C6",
    accentSoft: "#83E7DC",
    accentDeep: "#22B7A7",
    accentDark: "#08766D",
    accentLift: "#9AF0E7",
    accentPress: "#20AFA1",
    accentGlow: "#C5F8F3",
    surfaceAlt: "#EFFBFA",
    onDark: "#D4F5F2",
    onDarkMuted: "#9BCFC9",
  },
  natural: {
    primary: "#476A4E",
    primaryMid: "#38583F",
    deep: "#29442F",
    night: "#1C3021",
    abyss: "#101D14",
    accent: "#C88952",
    accentSoft: "#E0AE81",
    accentDeep: "#A96938",
    accentDark: "#76451F",
    accentLift: "#EDC49E",
    accentPress: "#A96332",
    accentGlow: "#F6DDC4",
    surfaceAlt: "#F4F2E8",
    onDark: "#DCE9DE",
    onDarkMuted: "#A9BEAC",
  },
  mono: {
    primary: "#303030",
    primaryMid: "#262626",
    deep: "#1E1E1E",
    night: "#151515",
    abyss: "#0B0B0B",
    accent: "#D6D6D6",
    accentSoft: "#EEEEEE",
    accentDeep: "#B5B5B5",
    accentDark: "#555555",
    accentLift: "#F5F5F5",
    accentPress: "#A8A8A8",
    accentGlow: "#FFFFFF",
    surfaceAlt: "#F3F3F3",
    ink: "#171717",
    inkMuted: "#565656",
    onDark: "#E2E2E2",
    onDarkMuted: "#A7A7A7",
  },
};

function nullIfEmpty(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isAbsoluteAsset(value: string | undefined): value is string {
  return Boolean(value && (value.startsWith("/") || value.startsWith("https://")));
}

/** Launchpad `/local-assets` URLs are not reachable on the deployed Worker. */
function isPublicDeployAsset(value: string | undefined): value is string {
  return isPublicDeployAssetUrl(value);
}

function publishableAssetUrl(value: string | undefined): string | undefined {
  return isPublicDeployAsset(value) ? value : undefined;
}

export const CLIENT_DEPLOY_REQUIRED_ASSETS = [
  "navLogo",
  "footerLogo",
  "favicon",
  "ogImage",
] as const;

export type ClientDeployAssetInput =
  | Record<string, string>
  | Array<{ slot: string; storageUrl?: string | null }>;

function assetUrlsFrom(assets: ClientDeployAssetInput): Record<string, string> {
  if (Array.isArray(assets)) {
    return Object.fromEntries(assets.map(asset => [asset.slot, asset.storageUrl ?? ""]));
  }
  return assets;
}

function hasMapCoordinates(input: AstroClientConfigInput): boolean {
  const latitude = Number(input.address.latitude);
  const longitude = Number(input.address.longitude);
  return (
    input.address.latitude.trim() !== "" &&
    input.address.longitude.trim() !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

/**
 * Gaps that keep `deployMode` on `template` and therefore block publish.
 * Launch and the canonical writer share this list so they cannot drift.
 */
export function clientDeployGaps(
  input: AstroClientConfigInput,
  assets: ClientDeployAssetInput,
): string[] {
  const urls = assetUrlsFrom(assets);
  const gaps: string[] = [];
  if (!isHttpsUrl(input.identity.siteUrl)) gaps.push("HTTPS website address");
  if (!input.hours.some(hour => hour.isOpen)) gaps.push("At least one open day");
  if (!hasMapCoordinates(input)) gaps.push("Map coordinates");
  if (!ASTRO_CATEGORY_VALUES.some(category => input.categories[category].enabled)) {
    gaps.push("At least one product category");
  }
  const missingAssets = CLIENT_DEPLOY_REQUIRED_ASSETS.filter(slot => !isAbsoluteAsset(urls[slot]));
  if (missingAssets.length) gaps.push(`Site images: ${missingAssets.join(", ")}`);
  return gaps;
}

function splitConfiguredLines(value: string, expectedParts: number): string[][] {
  return value
    .split(/\r?\n/)
    .map(line => line.split("|").map(part => part.trim()))
    .filter(parts =>
      parts.length >= expectedParts &&
      parts.slice(0, expectedParts).every(Boolean),
    );
}

function parseServiceAreas(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map(area => area.trim())
    .filter(Boolean);
}

function toClaims(value: string): Array<{ text: string; superlative: false; footnote: null }> {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(text => ({ text, superlative: false as const, footnote: null }));
}

function toActions(
  ...pairs: Array<{ label: string; href: string; style: "primary" | "secondary" }>
): Array<{ label: string; href: string; style: "primary" | "secondary" }> {
  return pairs
    .filter(pair => pair.label && pair.href)
    .map(pair => ({
      label: pair.label,
      href: rewriteTemplateHref(pair.href),
      style: pair.style,
    }));
}

function parseImageCards(
  value: string,
): Array<{ title: string; body: string | null; image: string | null; href: string }> {
  return splitConfiguredLines(value, 3).map(([title, body, href, image]) => ({
    title,
    body: nullIfEmpty(body ?? ""),
    image: publishableAssetUrl(image) ?? null,
    href: rewriteTemplateHref(href),
  }));
}

function isYes(value: string | undefined): boolean {
  return value === "yes" || value === "true" || value === "1";
}

function toCanonicalHomepageSection(
  section: AstroHomepageSection,
  galleryLibrary: readonly MediaLibraryItemRef[] = [],
): Record<string, unknown> | null {
  if (!section.enabled) return null;
  const field = (name: string) => section.fields[name]?.trim() ?? "";
  const assetUrl = (value: string | undefined) => publishableAssetUrl(value);
  const actions = toActions(
    { label: field("ctaLabel"), href: field("ctaHref"), style: "primary" },
    { label: field("ctaLabel2"), href: field("ctaHref2"), style: "secondary" },
  );

  switch (section.type) {
    case "announcement":
      return field("text")
        ? {
            type: "announcement",
            badge: nullIfEmpty(field("badge")),
            text: field("text"),
            href: nullIfEmpty(field("href")),
          }
        : null;
    case "hero":
      return {
        type: "hero",
        eyebrow: nullIfEmpty(field("eyebrow")),
        headline: nullIfEmpty(field("headline")),
        highlight: field("highlight")
          .split(",")
          .map(part => part.trim())
          .filter(Boolean),
        subhead: nullIfEmpty(field("subheadline")),
        bullets: toClaims(field("bullets")),
        backgroundImage: assetUrl(field("backgroundImage")) ?? null,
        image: null,
        promo: nullIfEmpty(field("promo")),
        actions,
        leadCard: field("leadHeading")
          ? {
              heading: field("leadHeading"),
              subtext: nullIfEmpty(field("leadSubtext")),
              footnote: nullIfEmpty(field("leadFootnote")),
            }
          : null,
      };
    case "stats": {
      const items = splitConfiguredLines(field("items"), 2).map(([value, label]) => ({
        value,
        label,
        claim: null,
      }));
      return items.length > 0 ? { type: "stats", items } : null;
    }
    case "offercard":
      return field("heading")
        ? {
            type: "offercard",
            eyebrow: nullIfEmpty(field("eyebrow")),
            heading: field("heading"),
            body: nullIfEmpty(field("body")),
            bullets: toClaims(field("bullets")),
            actions,
          }
        : null;
    case "products": {
      const limit = Number(field("limit") || "4");
      return {
        type: "products",
        eyebrow: nullIfEmpty(field("eyebrow")),
        heading: field("heading"),
        body: nullIfEmpty(field("body")),
        limit: Number.isFinite(limit) ? Math.min(24, Math.max(1, Math.round(limit))) : 4,
        category: nullIfEmpty(field("category")),
        moreLink: field("moreLabel") && field("moreHref")
          ? { label: field("moreLabel"), href: rewriteTemplateHref(field("moreHref")), style: "primary" }
          : null,
        disclaimer: nullIfEmpty(field("disclaimer")),
      };
    }
    case "categoryrow":
      return {
        type: "categories",
        eyebrow: nullIfEmpty(field("eyebrow")),
        heading: field("heading") || "What we sell",
        body: nullIfEmpty(field("body")),
        showImages: true,
      };
    case "cards":
    case "imagecards": {
      const items = parseImageCards(field("items"));
      return items.length > 0
        ? {
            type: "imagecards",
            eyebrow: nullIfEmpty(field("eyebrow") || field("intro")),
            heading: nullIfEmpty(field("heading")),
            items,
          }
        : null;
    }
    case "benefits": {
      const items = splitConfiguredLines(field("items"), 2).map(([title, body, icon]) => ({
        title,
        body,
        icon: assetUrl(icon) ?? null,
      }));
      return items.length > 0
        ? { type: "benefits", heading: nullIfEmpty(field("heading")), items }
        : null;
    }
    case "visit":
      return {
        type: "splitcards",
        heading: field("heading"),
        items: [{
          title: field("heading"),
          body: field("body"),
          image: null,
          showAddress: true,
          showHours: true,
          actions,
        }],
      };
    case "splitcards": {
      const items = splitConfiguredLines(field("items"), 2).map(([title, body, href, address, hours]) => ({
        title,
        body,
        image: null,
        showAddress: isYes(address),
        showHours: isYes(hours),
        actions: href
          ? [{ label: "Learn more", href: rewriteTemplateHref(href), style: "primary" as const }]
          : [],
      }));
      return items.length > 0
        ? {
            type: "splitcards",
            eyebrow: nullIfEmpty(field("eyebrow")),
            heading: nullIfEmpty(field("heading")),
            items,
          }
        : null;
    }
    case "steps": {
      const items = splitConfiguredLines(field("steps"), 2).map(
        ([title, body]) => ({ title, body }),
      );
      return items.length > 0
        ? { type: "steps", eyebrow: nullIfEmpty(field("eyebrow")), heading: field("heading"), items }
        : null;
    }
    case "gallery": {
      const images = resolveGalleryImages(field("images"), galleryLibrary, field("heading"))
        .map(image => ({ ...image, src: assetUrl(image.src) ?? "" }))
        .filter(image => image.src);
      return images.length > 0
        ? { type: "gallery", heading: nullIfEmpty(field("heading")), images }
        : null;
    }
    case "reviews": {
      const items = splitConfiguredLines(field("items"), 2).map(([name, quote, rating, source, date]) => {
        const parsed = Number(rating);
        return {
          name,
          quote,
          rating: Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 5,
          source: nullIfEmpty(source ?? ""),
          date: nullIfEmpty(date ?? ""),
          location: null,
          detail: null,
        };
      });
      if (items.length === 0) return null;
      const [aggregateRating, aggregateCount, aggregateSource] = field("aggregate")
        .split("|")
        .map(part => part.trim());
      const rating = Number(aggregateRating);
      const count = Number(aggregateCount);
      return {
        type: "reviews",
        eyebrow: nullIfEmpty(field("eyebrow")),
        heading: nullIfEmpty(field("heading")),
        items,
        aggregate: Number.isFinite(rating) && Number.isFinite(count) && count >= 1
          ? {
              rating: Math.min(5, Math.max(1, rating)),
              count: Math.round(count),
              source: nullIfEmpty(aggregateSource ?? ""),
            }
          : null,
      };
    }
    case "comparison": {
      const rows = splitConfiguredLines(field("rows"), 3).map(([label, us, them]) => ({
        label,
        us,
        them,
      }));
      return rows.length > 0
        ? {
            type: "comparison",
            eyebrow: nullIfEmpty(field("eyebrow")),
            heading: field("heading"),
            body: nullIfEmpty(field("body")),
            usLabel: null,
            themLabel: field("themLabel") || "Everyone else",
            rows,
          }
        : null;
    }
    case "promise": {
      const bullets = toClaims(field("bullets"));
      return field("heading") && bullets.length > 0
        ? {
            type: "promise",
            badgeValue: nullIfEmpty(field("badgeValue")),
            badgeLabel: nullIfEmpty(field("badgeLabel")),
            heading: field("heading"),
            body: nullIfEmpty(field("body")),
            bullets,
          }
        : null;
    }
    case "bignumber":
      return { type: "bignumber", value: field("value"), label: field("label"), claim: null };
    case "faq": {
      const items = splitConfiguredLines(field("items"), 2).map(([q, a]) => ({ q, a }));
      return items.length > 0
        ? { type: "faq", eyebrow: nullIfEmpty(field("eyebrow")), heading: nullIfEmpty(field("heading")), items }
        : null;
    }
    case "ctaband":
      return {
        type: "ctaband",
        eyebrow: nullIfEmpty(field("eyebrow")),
        heading: field("headline"),
        body: nullIfEmpty(field("subheadline")),
        actions,
        footnote: nullIfEmpty(field("footnote")),
        tone: "dark",
      };
    case "cta":
      return field("headline") && field("ctaLabel")
        ? {
            type: "cta",
            heading: field("headline"),
            buttonLabel: field("ctaLabel"),
            subtext: nullIfEmpty(field("subtext") || field("subheadline")),
          }
        : null;
    case "trust": {
      const items = field("items")
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
      return items.length > 0 ? { type: "trust", items, logos: [] } : null;
    }
    case "countdown":
      return field("heading") && field("endsAt")
        ? {
            type: "countdown",
            eyebrow: nullIfEmpty(field("eyebrow")),
            heading: field("heading"),
            body: nullIfEmpty(field("body")),
            endsAt: field("endsAt"),
          }
        : null;
    default: {
      const _exhaustive: never = section.type;
      return _exhaustive;
    }
  }
}

function orderCanonicalHomepageSections(
  sections: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const announcements = sections.filter(section => section.type === "announcement");
  const rest = sections.filter(section => section.type !== "announcement");
  return [...announcements.slice(0, 1), ...rest];
}

function homepageLeadIsSafe(sections: Array<Record<string, unknown>>): boolean {
  if (sections.length === 0) return true;
  const first = sections[0]?.type;
  return first === "hero" || first === "announcement";
}

export function toCanonicalAstroClientConfig(
  input: AstroClientConfigInput,
  assets: Record<string, string>,
  galleryLibrary: readonly MediaLibraryItemRef[] = [],
): Record<string, unknown> {
  const enabledCategories = ASTRO_CATEGORY_VALUES.filter(
    category => input.categories[category].enabled,
  );
  const openHours = input.hours
    .filter(hour => hour.isOpen)
    .map(hour => ({
      days: [CANONICAL_DAY_NAMES[hour.day]],
      opens: hour.opensAt,
      closes: hour.closesAt,
    }));
  const coordinates = {
    latitude: Number(input.address.latitude),
    longitude: Number(input.address.longitude),
  };
  const hasCoordinates = hasMapCoordinates(input);
  const siteUrl = isHttpsUrl(input.identity.siteUrl)
    ? input.identity.siteUrl
    : "https://example.com";
  const country = /^[A-Za-z]{2}$/.test(input.address.country)
    ? input.address.country.toUpperCase()
    : "US";
  const deployMode = clientDeployGaps(input, assets).length === 0 ? "client" : "template";

  const categories = Object.fromEntries(enabledCategories.map((category, index) => {
    const configured = input.categories[category];
    const asset = assets[CATEGORY_ASSET_SLOTS[category]] || configured.heroImage;
    return [CANONICAL_CATEGORY_KEYS[category], {
      enabled: true,
      label: configured.label,
      blurb: configured.description,
      heroImage: publishableAssetUrl(asset) ?? null,
      sortOrder: index,
    }];
  }));
  const enabledCanonicalCategories = new Set(Object.keys(categories));
  const financing = input.financing.enabled
    ? {
        headline: input.financing.ctaLabel,
        blurb: input.financing.monthlyExample,
        bullets: [input.financing.terms],
        lenderName: input.financing.lenderName,
        applyUrl: isHttpsUrl(input.financing.lenderUrl)
          ? input.financing.lenderUrl
          : null,
        disclaimer: input.financing.disclaimer,
      }
    : null;
  const navItems = input.navigationItems.flatMap(item => {
    if (item.type === "categories") return [{ type: "categories" }];
    const rawHref = item.href.trim();
    const href = rewriteTemplateHref(rawHref);
    if (!item.label.trim()) return [];
    if (href === "/financing" && !financing) return [];
    const categoryKey = CANONICAL_CATEGORY_ROUTES[href.replace(/\/$/, "")]
      ?? CANONICAL_CATEGORY_ROUTES[rawHref.replace(/\/$/, "")];
    if (categoryKey && !enabledCanonicalCategories.has(categoryKey)) return [];
    const resolvedHref = categoryKey ? CANONICAL_CATEGORY_HREFS[categoryKey] ?? href : href;
    if (resolvedHref.startsWith("/")) {
      return [{ type: "link", label: item.label, href: resolvedHref, inHeader: item.inHeader, inFooter: item.inFooter }];
    }
    if (isHttpsUrl(href)) {
      return [{ type: "external", label: item.label, href, inHeader: item.inHeader, inFooter: item.inFooter }];
    }
    return [];
  });
  const homepageSections = orderCanonicalHomepageSections(
    input.homepageSections
      .map(section => toCanonicalHomepageSection(section, galleryLibrary))
      .filter((section): section is Record<string, unknown> => section !== null),
  );
  const safeHomepageSections = homepageLeadIsSafe(homepageSections) ? homepageSections : [];

  return {
    deployMode,
    identity: {
      name: input.identity.businessName,
      shortName: input.identity.shortName,
      foundedYear: input.identity.foundedYear,
      tagline: input.identity.tagline,
      siteUrl,
      schemaType: input.identity.schemaType,
    },
    contact: {
      phone: input.contact.phone,
      phoneDisplayOverride: nullIfEmpty(input.contact.phoneDisplayOverride),
      smsPhone: nullIfEmpty(input.contact.smsPhone),
      email: nullIfEmpty(input.contact.email),
    },
    address: {
      street: input.address.street1,
      street2: nullIfEmpty(input.address.street2),
      city: input.address.city,
      region: input.address.state,
      postalCode: input.address.postalCode,
      country,
      latitude: hasCoordinates ? coordinates.latitude : 0,
      longitude: hasCoordinates ? coordinates.longitude : 0,
      googlePlaceId: nullIfEmpty(input.address.googlePlaceId),
    },
    hours: openHours.length > 0
      ? openHours
      : [{
          days: BUSINESS_DAY_VALUES.map(day => CANONICAL_DAY_NAMES[day]),
          opens: "09:00",
          closes: "17:00",
        }],
    social: Object.fromEntries(
      Object.entries(input.socialLinks).map(([name, value]) => [
        name,
        isHttpsUrl(value) ? value : null,
      ]),
    ),
    brand: {
      colors: { ...BASE_CANONICAL_COLORS, ...THEME_COLOR_OVERRIDES[input.brand.theme] },
      fonts: {
        display: input.brand.fonts.display,
        body: input.brand.fonts.body,
        mono: input.brand.fonts.mono,
        googleFontsHref: nullIfEmpty(input.brand.fonts.googleFontsUrl),
      },
      logos: {
        nav: publishableAssetUrl(assets.navLogo) ?? "/brand/logo-nav.svg",
        footer: publishableAssetUrl(assets.footerLogo) ?? "/brand/logo-footer.svg",
        inventory: publishableAssetUrl(assets.inventoryLogo) ?? null,
        favicon: publishableAssetUrl(assets.favicon) ?? "/brand/favicon.svg",
        ogImage: publishableAssetUrl(assets.ogImage) ?? "/brand/og-default.png",
      },
      radius: CANONICAL_BRAND_RADIUS,
    },
    nav: {
      items: navItems.length > 0 ? navItems : [{ type: "categories" }],
      primaryCta: { label: "Shop Inventory", href: "/inventory" },
      legalItems: [{ label: "Privacy Policy", href: "/privacy-policy" }],
    },
    categories,
    serviceAreas: parseServiceAreas(input.serviceAreas),
    financing,
    display: { showPrice: true, showMonthly: Boolean(financing) },
    homepage: {
      title: null,
      description: null,
      sections: safeHomepageSections,
      disclosures: [],
    },
    integrations: {
      d1BindingName: "DB",
      r2BindingName: "PRODUCT_IMAGES",
      ghl: { enabled: input.integrations.ghl.enabled },
      meta: { enabled: input.integrations.meta.enabled },
      zaraz: { enabled: input.integrations.zaraz.enabled },
      sentry: { enabled: input.integrations.sentry.enabled },
    },
  };
}

export function generateAstroClientConfig(
  input: AstroClientConfigInput,
  assets: Record<string, string>,
  galleryLibrary: readonly MediaLibraryItemRef[] = [],
): string {
  const config = toCanonicalAstroClientConfig(input, assets, galleryLibrary);
  return [
    "// Generated by Site Launchpad. Edit in the dashboard and export again.",
    'import type { ClientConfigInput } from "./schema";',
    "",
    `export const rawClientConfig: ClientConfigInput = ${JSON.stringify(config, null, 2)};`,
    "",
  ].join("\n");
}

export function emptyWranglerSecretStatus(): Record<WranglerSecretName, boolean> {
  return Object.fromEntries(WRANGLER_SECRET_VALUES.map(name => [name, false])) as Record<WranglerSecretName, boolean>;
}
