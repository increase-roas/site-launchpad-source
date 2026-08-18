import { z } from "zod";

export const THEME_VALUES = ["aqua", "luxury", "natural", "mono"] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export const PRODUCT_CATEGORY_VALUES = [
  "hotTubs",
  "swimSpas",
  "saunas",
  "coldPlunge",
  "massageChairs",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORY_VALUES)[number];

export const BUSINESS_DAY_VALUES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type BusinessDay = (typeof BUSINESS_DAY_VALUES)[number];

export const ASSET_SLOT_VALUES = [
  "logo",
  "hero",
  "hotTubs",
  "swimSpas",
  "showroom",
  "product",
  "delivery",
] as const;
export type AssetSlot = (typeof ASSET_SLOT_VALUES)[number];

export function isAssetSlot(value: string): value is AssetSlot {
  return (ASSET_SLOT_VALUES as readonly string[]).includes(value);
}

export const MARKETING_ASSET_SLOT_VALUES = [
  "hero",
  "hotTubs",
  "swimSpas",
  "showroom",
  "product",
  "delivery",
] as const;
export type MarketingAssetSlot = (typeof MARKETING_ASSET_SLOT_VALUES)[number];

export const ASSET_SLOT_LABELS: Record<AssetSlot, string> = {
  logo: "Logo",
  hero: "Main photo",
  hotTubs: "Hot tubs photo",
  swimSpas: "Swim spas photo",
  showroom: "Showroom photo",
  product: "Product photo",
  delivery: "Delivery photo",
};

export const ASSET_SLOT_FILENAMES: Record<AssetSlot, string> = {
  logo: "logo.webp",
  hero: "hero.webp",
  hotTubs: "category-hot-tubs.webp",
  swimSpas: "category-swim-spas.webp",
  showroom: "showroom.webp",
  product: "product.webp",
  delivery: "delivery.webp",
};

export const SECRET_FIELD_VALUES = [
  "metaPixelId",
  "ga4MeasurementId",
  "clarityId",
  "ghlApiKey",
  "ghlWebhookUrl",
  "cloudflareProjectName",
] as const;
export type SecretField = (typeof SECRET_FIELD_VALUES)[number];

export const CLIENT_READINESS_SECRET_FIELD_VALUES = [
  "metaPixelId",
  "ga4MeasurementId",
  "clarityId",
  "ghlApiKey",
  "cloudflareProjectName",
] as const satisfies readonly SecretField[];

export const OPTIONAL_CLIENT_READINESS_SECRET_FIELDS = [
  "ga4MeasurementId",
  "clarityId",
] as const satisfies readonly SecretField[];

export const SECRET_FIELD_LABELS: Record<SecretField, string> = {
  metaPixelId: "Meta Pixel ID",
  ga4MeasurementId: "GA4 Measurement ID",
  clarityId: "Microsoft Clarity ID",
  ghlApiKey: "GHL API key",
  ghlWebhookUrl: "GHL webhook URL",
  cloudflareProjectName: "Cloudflare project name",
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const businessHourSchema = z
  .object({
    day: z.enum(BUSINESS_DAY_VALUES),
    isOpen: z.boolean(),
    opensAt: z.string(),
    closesAt: z.string(),
  })
  .superRefine((hour, context) => {
    if (!hour.isOpen) return;

    if (!timePattern.test(hour.opensAt)) {
      context.addIssue({
        code: "custom",
        path: ["opensAt"],
        message: "Choose an opening time.",
      });
    }

    if (!timePattern.test(hour.closesAt)) {
      context.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "Choose a closing time.",
      });
    }

    if (
      timePattern.test(hour.opensAt) &&
      timePattern.test(hour.closesAt) &&
      hour.opensAt >= hour.closesAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "Closing time must be after opening time.",
      });
    }
  });

export type BusinessHour = z.infer<typeof businessHourSchema>;

function parseWebUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a complete web address, including https://")
  .refine(value => {
    const url = parseWebUrl(value);
    return Boolean(url && (url.protocol === "http:" || url.protocol === "https:"));
  }, "Enter a web address that starts with https://");

const facebookUrlSchema = httpUrlSchema.refine(value => {
  const host = parseWebUrl(value)?.hostname.toLowerCase();
  return Boolean(
    host && (host === "facebook.com" || host === "fb.com" || host.endsWith(".facebook.com")),
  );
}, "Enter a Facebook page address.");

const googleMapsUrlSchema = httpUrlSchema.refine(value => {
  const host = parseWebUrl(value)?.hostname.toLowerCase();
  if (!host) return false;
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "goo.gl" ||
    host.endsWith(".goo.gl")
  );
}, "Enter a Google Maps address.");

export const clientInputSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the full business name.").max(160),
  shortName: z
    .string()
    .trim()
    .min(2, "Enter a short name.")
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Use letters, numbers, spaces, and hyphens only."),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use international format, such as +17015551234."),
  email: z.string().trim().email("Enter a valid email address.").max(320),
  streetAddress: z.string().trim().min(3, "Enter the street address.").max(240),
  city: z.string().trim().min(2, "Enter the city.").max(120),
  state: z.string().trim().min(2, "Enter the state or region.").max(120),
  postalCode: z.string().trim().min(3, "Enter the ZIP or postal code.").max(24),
  country: z.string().trim().min(2, "Enter the country.").max(120),
  websiteUrl: httpUrlSchema.max(500),
  foundedYear: z
    .number()
    .int("Enter a four-digit year.")
    .min(1800, "Enter a year from 1800 onward.")
    .max(new Date().getFullYear(), "Founded year cannot be in the future."),
  tagline: z.string().trim().min(3, "Enter the business tagline.").max(240),
  theme: z.enum(THEME_VALUES, { error: "Choose a theme." }),
  businessHours: z
    .array(businessHourSchema)
    .length(7, "Set hours for every day.")
    .superRefine((hours, context) => {
      const days = new Set(hours.map(hour => hour.day));
      if (days.size !== BUSINESS_DAY_VALUES.length) {
        context.addIssue({ code: "custom", message: "Set hours for every day." });
      }
      if (!hours.some(hour => hour.isOpen)) {
        context.addIssue({ code: "custom", message: "Mark at least one day as open." });
      }
    }),
  facebookUrl: facebookUrlSchema.max(500),
  googleMapsUrl: googleMapsUrlSchema.max(1000),
  productCategories: z
    .array(z.enum(PRODUCT_CATEGORY_VALUES))
    .min(1, "Choose at least one product category."),
  primaryOffer: z.string().trim().min(3, "Enter the primary offer.").max(2000),
  financingPromise: z.string().trim().min(3, "Enter the financing promise.").max(2000),
  deliveryPromise: z.string().trim().min(3, "Enter the delivery promise.").max(2000),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export const draftClientInputSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the business name.").max(160),
});
export type DraftClientInput = z.infer<typeof draftClientInputSchema>;

export const CLOSED_BUSINESS_HOURS: BusinessHour[] = BUSINESS_DAY_VALUES.map(day => ({
  day,
  isOpen: false,
  opensAt: "09:00",
  closesAt: "17:00",
}));

const optionalPattern = (schema: z.ZodString) => z.union([z.literal(""), schema]).optional();

export const secretSetupInputSchema = z.object({
  metaPixelId: optionalPattern(
    z.string().trim().regex(/^\d{5,30}$/, "Meta Pixel ID should contain numbers only."),
  ),
  ga4MeasurementId: optionalPattern(
    z
      .string()
      .trim()
      .regex(/^G-[A-Z0-9]{4,20}$/i, "GA4 Measurement ID should look like G-ABC1234."),
  ),
  clarityId: optionalPattern(
    z
      .string()
      .trim()
      .regex(/^[A-Z0-9_-]{6,40}$/i, "Microsoft Clarity ID is not in the expected format."),
  ),
  ghlApiKey: optionalPattern(
    z.string().trim().min(10, "GHL API key looks too short.").max(5000),
  ),
  ghlWebhookUrl: optionalPattern(httpUrlSchema.max(1000)),
  cloudflareProjectName: optionalPattern(
    z
      .string()
      .trim()
      .regex(
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
        "Use lowercase letters, numbers, and hyphens only.",
      ),
  ),
});

export type SecretSetupInput = z.infer<typeof secretSetupInputSchema>;

export type SecretStatus = Record<SecretField, boolean>;

export type ReadinessItem = {
  key: string;
  label: string;
  complete: boolean;
  group: "details" | "photos" | "setup";
};

export type ReadinessSummary = {
  items: ReadinessItem[];
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
};

export const businessInformationSchema = clientInputSchema.omit({ theme: true });

export function buildReadiness(
  client: Partial<ClientInput>,
  presentAssetSlots: Iterable<AssetSlot>,
  secretStatus: SecretStatus,
): ReadinessSummary {
  const assets = new Set(presentAssetSlots);
  const items: ReadinessItem[] = [
    {
      key: "businessInformation",
      label: "Business information",
      complete: businessInformationSchema.safeParse(client).success,
      group: "details",
    },
    {
      key: "theme",
      label: "Theme selected",
      complete: THEME_VALUES.includes(client.theme as ThemeValue),
      group: "details",
    },
    {
      key: "asset-logo",
      label: ASSET_SLOT_LABELS.logo,
      complete: assets.has("logo"),
      group: "photos",
    },
    ...MARKETING_ASSET_SLOT_VALUES.map<ReadinessItem>(slot => ({
      key: `asset-${slot}`,
      label: ASSET_SLOT_LABELS[slot],
      complete: assets.has(slot),
      group: "photos",
    })),
    ...CLIENT_READINESS_SECRET_FIELD_VALUES.map<ReadinessItem>(field => ({
      key: `secret-${field}`,
      label: SECRET_FIELD_LABELS[field],
      complete: secretStatus[field],
      group: "setup",
    })),
  ];

  const completed = items.filter(item => item.complete).length;
  const total = items.length;
  const optionalSecretKeys = new Set(
    OPTIONAL_CLIENT_READINESS_SECRET_FIELDS.map(field => `secret-${field}`),
  );
  const blockingIncomplete = items.some(
    item => !item.complete && !optionalSecretKeys.has(item.key),
  );

  return {
    items,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    isComplete: !blockingIncomplete,
  };
}

export function emptySecretStatus(): SecretStatus {
  return {
    metaPixelId: false,
    ga4MeasurementId: false,
    clarityId: false,
    ghlApiKey: false,
    ghlWebhookUrl: false,
    cloudflareProjectName: false,
  };
}

export function sanitizeClientFolder(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
