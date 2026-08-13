import { z } from "zod";
import { BUSINESS_DAY_VALUES, businessHourSchema } from "./client";

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
  "hero",
  "cards",
  "visit",
  "steps",
  "gallery",
  "reviews",
  "bignumber",
  "faq",
  "ctaband",
  "cta",
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
  "META_VALUE_QUALIFIED",
  "META_VALUE_SCHEDULE",
  "META_VALUE_SHOWED",
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
  META_VALUE_QUALIFIED: "Lead value used for qualified prospects",
  META_VALUE_SCHEDULE: "Lead value used for scheduled appointments",
  META_VALUE_SHOWED: "Lead value used for completed showroom visits",
  STAGE_WEBHOOK_SECRET: "Shared secret for stage-change webhooks",
  GOOGLE_SHEETS_ID: "Destination Google Sheet ID",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "Google service-account email",
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
  hero: ["headline", "subheadline", "ctaLabel", "ctaHref"],
  cards: ["heading", "items"],
  visit: ["heading", "body", "ctaLabel", "ctaHref"],
  steps: ["heading", "steps"],
  gallery: ["heading", "images"],
  reviews: ["heading", "source"],
  bignumber: ["value", "label"],
  faq: ["heading", "items"],
  ctaband: ["headline", "ctaLabel", "ctaHref"],
  cta: ["headline", "ctaLabel", "ctaHref"],
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
  hours: z.array(businessHourSchema).length(7),
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
    borderRadii: z.object({ card: z.number().min(0).max(999), button: z.number().min(0).max(999), pill: z.number().min(0).max(999) }),
  }),
  navigationItems: z.array(astroNavigationItemSchema).max(30),
  categories: z.record(z.enum(ASTRO_CATEGORY_VALUES), astroCategorySchema),
  financing: astroFinancingSchema,
  homepageSections: z.array(astroHomepageSectionSchema).max(40),
  integrations: z.record(z.enum(ASTRO_INTEGRATION_VALUES), astroIntegrationSchema),
});

export type AstroClientConfigInput = z.infer<typeof astroClientConfigInputSchema>;
export type AstroNavigationItem = z.infer<typeof astroNavigationItemSchema>;
export type AstroHomepageSection = z.infer<typeof astroHomepageSectionSchema>;

const sectionFields: Record<AstroSectionType, Record<string, string>> = {
  hero: { eyebrow: "", headline: "", subheadline: "", ctaLabel: "", ctaHref: "" },
  cards: { heading: "", intro: "", items: "" },
  visit: { heading: "", body: "", ctaLabel: "", ctaHref: "" },
  steps: { heading: "", steps: "" },
  gallery: { heading: "", images: "" },
  reviews: { heading: "", source: "" },
  bignumber: { value: "", label: "", body: "" },
  faq: { heading: "", items: "" },
  ctaband: { headline: "", subheadline: "", ctaLabel: "", ctaHref: "" },
  cta: { headline: "", ctaLabel: "", ctaHref: "" },
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

export const ASTRO_INTEGRATION_FIELDS: Record<AstroIntegration, Record<string, string>> = {
  d1: { binding: "Binding name", databaseName: "Database name" },
  r2: { binding: "Binding name", bucketName: "Bucket name" },
  ghl: { locationId: "Location ID", webhookUrl: "Webhook URL" },
  meta: { pixelId: "Pixel ID", datasetId: "Dataset ID" },
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
    brand: { theme: client.theme, fonts: { display: "Manrope", body: "Manrope", mono: "JetBrains Mono", googleFontsUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" }, borderRadii: { card: 24, button: 12, pill: 999 } },
    navigationItems: [
      { id: "nav-categories", type: "categories", label: "Products", href: "", inHeader: true, inFooter: true },
      { id: "nav-visit", type: "link", label: "Visit Us", href: "/visit-us", inHeader: true, inFooter: true },
      { id: "nav-financing", type: "link", label: "Financing", href: "/financing", inHeader: true, inFooter: true },
    ],
    categories,
    financing: { enabled: false, lenderName: "", lenderUrl: "", disclaimer: "", terms: "", ctaLabel: "Apply for financing", monthlyExample: "" },
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
              ctaHref: "/contact",
            },
          }
        : section;
    }),
    integrations,
  };
}

export function generateAstroClientConfig(input: AstroClientConfigInput, assets: Record<string, string>): string {
  const config = {
    ...input,
    brand: { ...input.brand, assets },
  };
  return [
    "// Generated by Site Launchpad. Edit in the dashboard and export again.",
    `export const clientConfig = ${JSON.stringify(config, null, 2)} as const;`,
    "",
    "export type ClientConfig = typeof clientConfig;",
    "",
  ].join("\n");
}

export function emptyWranglerSecretStatus(): Record<WranglerSecretName, boolean> {
  return Object.fromEntries(WRANGLER_SECRET_VALUES.map(name => [name, false])) as Record<WranglerSecretName, boolean>;
}
