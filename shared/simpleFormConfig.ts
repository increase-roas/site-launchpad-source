import { z } from "zod";
import { ASSET_SLOT_VALUES } from "./client";
import { SIMPLE_FORM_MANIFEST } from "./simpleFormContract";

const e164 = /^\+[1-9]\d{7,14}$/;
const zip5 = /^\d{5}$/;
const productId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const funnelSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pixelId = /^\d{8,20}$/;

export const simpleFormImageSourceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("template") }),
  z.object({
    mode: z.literal("client-media"),
    slot: z.string().trim().min(1).max(80),
  }),
]);
export type SimpleFormImageSource = z.infer<typeof simpleFormImageSourceSchema>;

const optionalUrl = z
  .string()
  .trim()
  .refine(value => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter a complete URL.");

export const simpleFormOperatorProductSchema = z.object({
  id: z.string().trim().regex(productId, "Use lowercase letters, numbers, and hyphens."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
  imageUrl: z.string().trim().min(1),
  priceLabel: z.string().trim().max(60).optional(),
  ctaLabel: z.string().trim().min(2).max(50),
  ctaUrl: optionalUrl,
  active: z.boolean(),
});

export const simpleFormOperatorConfigSchema = z.object({
  client: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim(),
    logoUrl: z.string().trim().min(1),
    logoAlt: z.string().trim().min(2).max(120),
  }),
  funnel: z.object({
    slug: z.string().trim().regex(funnelSlug),
    shape: z.literal("A"),
    entryStyle: z.literal("simple"),
    ctaLabel: z.string().trim().min(3).max(50),
    advertorialLabel: z.string().trim().min(3).max(50),
    qualifyingLine: z.string().trim().min(12).max(180),
  }),
  offer: z.object({
    headline: z.string().trim().min(12).max(140),
    subheadline: z.string().trim().min(24).max(300),
  }),
  meta: z.object({
    pixelId: z.string().trim(),
    conversionEventName: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    viewContentDelayMs: z.number().int().min(3500).max(5000),
    currency: z.string().length(3),
    defaultConversionValue: z.number().nonnegative(),
  }),
  ga4MeasurementId: z.string().trim().optional(),
  googleEnhancedConversions: z.boolean(),
  progressStyle: z.enum(["counter", "bar", "both"]),
  approvedFramingHeadline: z.string().trim().min(12).max(140),
  geoH1Template: z.string().trim().min(20).max(180),
  serviceAreaZipCodes: z.array(z.string().trim()),
  surveyQuestions: z.array(z.never()).max(0),
  contact: z.object({
    headline: z.string().trim().min(12).max(180),
    submitLabel: z.string().trim().min(3).max(50),
    emailRequired: z.boolean(),
    consent: z.object({
      version: z.string().trim().min(1).max(40),
      text: z.string().trim().min(40).max(700),
    }),
  }),
  trust: z.object({
    eyebrow: z.string().trim().min(2).max(60),
    statement: z.string().trim().min(20).max(400),
  }),
  thankYou: z.object({
    headline: z.string().trim().min(6).max(120),
    message: z.string().trim().min(20).max(400),
  }),
  outOfArea: z.object({
    headline: z.string().trim().min(8).max(140),
    message: z.string().trim().min(20).max(400),
  }),
  validation: z.object({
    defaultCountry: z.string().trim().length(2),
    duplicateWindowHours: z.number().int().min(1).max(168),
  }),
  inventory: z.object({
    enabled: z.boolean(),
    headline: z.string().trim().min(8).max(140),
    subheadline: z.string().trim().min(12).max(280),
    pageUrl: z.string().trim().optional(),
    products: z.array(simpleFormOperatorProductSchema).length(5),
  }),
});
export type SimpleFormOperatorConfig = z.infer<typeof simpleFormOperatorConfigSchema>;

export const simpleFormStoredRecordSchema = z.object({
  recordVersion: z.literal(1),
  imageSources: z.object({
    logo: simpleFormImageSourceSchema,
    products: z.array(simpleFormImageSourceSchema).length(5),
  }),
  config: simpleFormOperatorConfigSchema,
});
export type SimpleFormStoredRecord = z.infer<typeof simpleFormStoredRecordSchema>;

export const SIMPLE_FORM_TEMPLATE_LOGO_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23155EEF' d='M8 16h40v8H16v8h40v8H24v8H8z'/%3E%3Cpath fill='%230B1F33' d='M48 16h8v8h-8zM8 40h8v8H8z'/%3E%3C/svg%3E";

export const SIMPLE_FORM_TEMPLATE_PRODUCTS: SimpleFormOperatorConfig["inventory"]["products"] = [
  {
    id: "serenity-6",
    name: "Serenity 6-Person Hot Tub",
    description: "In stock now — hydrotherapy jets, LED lighting, energy-smart cover.",
    imageUrl:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $8,499",
    ctaLabel: "Check availability",
    ctaUrl: "",
    active: true,
  },
  {
    id: "aqua-swim-14",
    name: "Aqua Swim Spa 14'",
    description: "Active floor model — swim current, seating zone, low-maintenance shell.",
    imageUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $18,900",
    ctaLabel: "Schedule a visit",
    ctaUrl: "",
    active: true,
  },
  {
    id: "compact-4",
    name: "Compact 4-Person Spa",
    description: "Small footprint, plug-and-play ready for patios and decks.",
    imageUrl:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $5,299",
    ctaLabel: "Get pricing",
    ctaUrl: "",
    active: true,
  },
  {
    id: "legacy-model",
    name: "Legacy Clearance Model",
    description: "Previously featured — not currently on the showroom floor.",
    imageUrl:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80",
    priceLabel: "Sold out",
    ctaLabel: "Notify me",
    ctaUrl: "",
    active: false,
  },
  {
    id: "family-8",
    name: "Family 8-Person Spa",
    description: "Showroom favorite — lounge seating, waterfall, and smart controls.",
    imageUrl:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $11,200",
    ctaLabel: "View on inventory page",
    ctaUrl: "",
    active: true,
  },
];

export function defaultSimpleFormImageSources(): SimpleFormStoredRecord["imageSources"] {
  return {
    logo: { mode: "template" },
    products: SIMPLE_FORM_TEMPLATE_PRODUCTS.map(() => ({ mode: "template" as const })),
  };
}

export function buildSimpleFormOperatorDefaults(input: {
  businessName: string;
  slug: string;
  phone?: string | null;
}): SimpleFormOperatorConfig {
  const name = input.businessName.trim();
  return {
    client: {
      name,
      phone: input.phone?.trim() ?? "",
      logoUrl: SIMPLE_FORM_TEMPLATE_LOGO_URL,
      logoAlt: name,
    },
    funnel: {
      slug: input.slug,
      shape: "A",
      entryStyle: "simple",
      ctaLabel: "Next step",
      advertorialLabel: "Advertisement",
      qualifyingLine: "For homeowners inside the local delivery and service area.",
    },
    offer: {
      headline: "See active inventory in the local area",
      subheadline: "Enter a ZIP code to view models that are actually in stock nearby.",
    },
    meta: {
      pixelId: "",
      conversionEventName: "Lead",
      viewContentDelayMs: 4000,
      currency: "USD",
      defaultConversionValue: 25,
    },
    googleEnhancedConversions: false,
    progressStyle: "both",
    approvedFramingHeadline: "Almost there — where should we send options?",
    geoH1Template: "Active Hot Tub Inventory In The {city}, {state} Area",
    serviceAreaZipCodes: [],
    surveyQuestions: [],
    contact: {
      headline: "Join thousands of local homeowners checking current showroom stock.",
      submitLabel: "Next step",
      emailRequired: true,
      consent: {
        version: "2026-08-13",
        text: "I agree to receive calls and text messages about this request at the number provided. Consent is not a condition of purchase. Message and data rates may apply.",
      },
    },
    trust: {
      eyebrow: "What happens next",
      statement:
        "A local showroom specialist reviews the submitted ZIP and preferences before following up with current availability and next steps.",
    },
    thankYou: {
      headline: "Your request is in.",
      message:
        "A local showroom specialist will review the details and follow up using the contact information provided.",
    },
    outOfArea: {
      headline: "This ZIP is outside the current service area.",
      message: "The local showroom is not currently scheduling delivery or service in this ZIP code.",
    },
    validation: {
      defaultCountry: "US",
      duplicateWindowHours: 24,
    },
    inventory: {
      enabled: true,
      headline: "Active inventory near you",
      subheadline: "These models are in stock at the local showroom. Tap a product to view full details.",
      products: SIMPLE_FORM_TEMPLATE_PRODUCTS,
    },
  };
}

export function buildSimpleFormStoredRecord(input: {
  businessName: string;
  slug: string;
  phone?: string | null;
}): SimpleFormStoredRecord {
  return {
    recordVersion: 1,
    imageSources: defaultSimpleFormImageSources(),
    config: buildSimpleFormOperatorDefaults(input),
  };
}

export type SimpleFormSecretPresence = Record<
  | "META_CAPI_ACCESS_TOKEN"
  | "META_TEST_EVENT_CODE"
  | "GHL_WEBHOOK_URL"
  | "CRM_CALLBACK_SECRET"
  | "SUBMISSION_ALERT_WEBHOOK_URL",
  boolean
>;

export type SimpleFormReadinessSection = {
  key: "client" | "offer" | "serviceArea" | "meta" | "ghl" | "inventory" | "productionSecrets";
  label: string;
  ready: boolean;
  missing: string[];
};

export type SimpleFormReadiness = {
  sections: SimpleFormReadinessSection[];
  configurationReady: boolean;
  published: false;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "tel:";
  } catch {
    return false;
  }
}

export function buildSimpleFormReadiness(
  record: SimpleFormStoredRecord,
  secrets: SimpleFormSecretPresence,
): SimpleFormReadiness {
  const { config } = record;
  const clientMissing: string[] = [];
  if (!config.client.name.trim()) clientMissing.push("Business name");
  if (!e164.test(config.client.phone.trim())) clientMissing.push("Client phone (E.164)");
  if (!config.client.logoUrl.trim()) clientMissing.push("Logo");

  const offerMissing: string[] = [];
  if (config.offer.headline.trim().length < 12) offerMissing.push("Offer headline");
  if (config.offer.subheadline.trim().length < 24) offerMissing.push("Offer subheadline");

  const zips = Array.from(new Set(config.serviceAreaZipCodes.map(zip => zip.trim()).filter(Boolean)));
  const serviceMissing: string[] = [];
  if (zips.length < 1) serviceMissing.push("At least one service-area ZIP");
  if (zips.some(zip => !zip5.test(zip))) serviceMissing.push("Every ZIP must be 5 digits");
  if (!config.geoH1Template.includes("{city}") || !config.geoH1Template.includes("{state}")) {
    serviceMissing.push("ZIP headline must include {city} and {state}");
  }

  const metaMissing: string[] = [];
  if (!pixelId.test(config.meta.pixelId.trim())) metaMissing.push("Meta Pixel ID");
  if (!secrets.META_CAPI_ACCESS_TOKEN) metaMissing.push("Meta CAPI Access Token");
  if (config.googleEnhancedConversions && !/^G-[A-Z0-9]{6,20}$/i.test(config.ga4MeasurementId ?? "")) {
    metaMissing.push("GA4 Measurement ID");
  }

  const ghlMissing: string[] = [];
  if (!secrets.GHL_WEBHOOK_URL) ghlMissing.push("GHL Webhook URL");

  const inventoryMissing: string[] = [];
  if (config.inventory.products.length !== 5) inventoryMissing.push("Exactly 5 inventory slots");
  const ids = config.inventory.products.map(product => product.id);
  if (new Set(ids).size !== ids.length) inventoryMissing.push("Unique product ids");
  if (config.inventory.enabled && !config.inventory.products.some(product => product.active)) {
    inventoryMissing.push("At least one active product");
  }
  config.inventory.products.forEach((product, index) => {
    const label = `Product ${index + 1}`;
    if (!productId.test(product.id)) inventoryMissing.push(`${label} id`);
    if (product.name.trim().length < 2) inventoryMissing.push(`${label} name`);
    if (!product.imageUrl.trim()) inventoryMissing.push(`${label} image`);
    if (product.ctaLabel.trim().length < 2) inventoryMissing.push(`${label} CTA label`);
    if (!isHttpUrl(product.ctaUrl.trim())) inventoryMissing.push(`${label} CTA URL`);
  });
  if (config.inventory.pageUrl?.trim() && !isHttpUrl(config.inventory.pageUrl.trim())) {
    inventoryMissing.push("Inventory page URL");
  }

  const secretMissing: string[] = [];
  if (!secrets.META_CAPI_ACCESS_TOKEN) secretMissing.push("Meta CAPI Access Token");
  if (!secrets.GHL_WEBHOOK_URL) secretMissing.push("GHL Webhook URL");
  if (!secrets.CRM_CALLBACK_SECRET) secretMissing.push("CRM Callback Secret");
  if (secrets.META_TEST_EVENT_CODE) secretMissing.push("Remove Meta Test Event Code before production");

  const sections: SimpleFormReadinessSection[] = [
    { key: "client", label: "Client", ready: clientMissing.length === 0, missing: clientMissing },
    { key: "offer", label: "Offer", ready: offerMissing.length === 0, missing: offerMissing },
    { key: "serviceArea", label: "Service Area", ready: serviceMissing.length === 0, missing: serviceMissing },
    { key: "meta", label: "Meta", ready: metaMissing.length === 0, missing: metaMissing },
    { key: "ghl", label: "GHL", ready: ghlMissing.length === 0, missing: ghlMissing },
    { key: "inventory", label: "Inventory", ready: inventoryMissing.length === 0, missing: inventoryMissing },
    {
      key: "productionSecrets",
      label: "Production Secrets",
      ready: secretMissing.length === 0,
      missing: secretMissing,
    },
  ];

  return {
    sections,
    configurationReady: sections.every(section => section.ready),
    published: false,
  };
}

export function resolveSimpleFormImages(
  record: SimpleFormStoredRecord,
  assets: Array<{ slot: string; storageUrl: string }>,
): SimpleFormOperatorConfig {
  const bySlot = new Map(assets.map(asset => [asset.slot, asset.storageUrl]));
  const logoUrl =
    record.imageSources.logo.mode === "client-media"
      ? (bySlot.get(record.imageSources.logo.slot) ?? record.config.client.logoUrl)
      : SIMPLE_FORM_TEMPLATE_LOGO_URL;
  const products = record.config.inventory.products.map((product, index) => {
    const source = record.imageSources.products[index];
    const templateUrl = SIMPLE_FORM_TEMPLATE_PRODUCTS[index]?.imageUrl ?? product.imageUrl;
    const imageUrl =
      source?.mode === "client-media" ? (bySlot.get(source.slot) ?? templateUrl) : templateUrl;
    return { ...product, imageUrl };
  });
  return {
    ...record.config,
    client: { ...record.config.client, logoUrl },
    inventory: { ...record.config.inventory, products },
  };
}

export function parseServiceAreaZips(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map(zip => zip.trim())
        .filter(Boolean),
    ),
  );
}

export function simpleFormFunnelName(businessName: string): string {
  return `${businessName.trim()} Simple Form Funnel`.slice(0, 160);
}

export function simpleFormFunnelSlug(shortName: string, used: Iterable<string>): string {
  const base = shortName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const root = `${base || "client"}-simple-form`.slice(0, 80);
  const taken = new Set(used);
  if (!taken.has(root)) return root;
  let suffix = 2;
  while (taken.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

export const SIMPLE_FORM_TEMPLATE_CARD = {
  ...SIMPLE_FORM_MANIFEST,
  flow: "ZIP → Contact → Thank You",
  inventory: "5 Inventory Slots",
  previewImageUrl: "/templates/simple-form-preview.svg",
};

const mediaSlots = new Set<string>(ASSET_SLOT_VALUES);
export function isSelectableMediaSlot(slot: string): boolean {
  return mediaSlots.has(slot) || slot.length > 0;
}
