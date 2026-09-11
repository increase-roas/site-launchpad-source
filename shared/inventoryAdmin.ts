import {
  ASTRO_CATEGORY_VALUES,
  type AstroCategory,
  type AstroClientConfigInput,
} from "./astroConfig";

/** Product.category values the live /admin API accepts. */
export const INVENTORY_CATEGORY_BY_ASTRO: Record<AstroCategory, string> = {
  "hot-tubs": "hot-tub",
  "swim-spas": "swim-spa",
  saunas: "sauna",
  "cold-plunge": "cold-plunge",
  "massage-chairs": "massage-chair",
};

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  "hot-tub": "Hot Tubs",
  "swim-spa": "Swim Spas",
  sauna: "Saunas",
  "cold-plunge": "Cold Plunge",
  "massage-chair": "Massage Chairs",
};

export const INVENTORY_STATUSES = [
  "draft",
  "available",
  "pending",
  "sold",
  "hidden",
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const INVENTORY_PATCH_STATUSES = [
  ...INVENTORY_STATUSES,
  "deleted",
] as const;

export type InventoryCategoryOption = {
  slug: string;
  label: string;
};

export function enabledInventoryCategories(
  config: AstroClientConfigInput,
): InventoryCategoryOption[] {
  return ASTRO_CATEGORY_VALUES.filter(key => config.categories[key].enabled).map(
    key => {
      const slug = INVENTORY_CATEGORY_BY_ASTRO[key];
      const label = config.categories[key].label.trim();
      return {
        slug,
        label: label || INVENTORY_CATEGORY_LABELS[slug] || slug,
      };
    },
  );
}

export function slugifyInventory(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanArray(value: unknown, maxItems: number, itemMax: number): string[] {
  return (Array.isArray(value) ? value : [])
    .map(item => cleanText(item, itemMax))
    .filter(Boolean)
    .slice(0, maxItems);
}

function numberInRange(value: unknown, min: number, max: number): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function cleanInventoryImageUrl(value: unknown): string {
  const url = cleanText(value, 600);
  if (!url) return "";
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export type InventoryProductInput = {
  slug?: unknown;
  inventory_name?: unknown;
  category?: unknown;
  status?: unknown;
  quantity?: unknown;
  price?: unknown;
  monthly_payment?: unknown;
  sort_order?: unknown;
  primary_image?: unknown;
  gallery_images?: unknown;
  quick_facts?: unknown;
  ghl_tags?: unknown;
  why_bullets?: unknown;
  promo_label?: unknown;
  delivery_promise?: unknown;
  headline?: unknown;
  positioning_label?: unknown;
  hero_description?: unknown;
  long_description?: unknown;
  best_for?: unknown;
  featured?: unknown;
};

export type ValidatedInventoryProduct = {
  slug: string;
  inventory_name: string;
  category: string;
  price: number;
  monthly_payment: number;
  status: InventoryStatus;
  quantity: number;
  primary_image: string;
  gallery_images: string[];
  quick_facts: string[];
  ghl_tags: string[];
  why_bullets: string[];
  promo_label: string;
  delivery_promise: string;
  headline: string;
  positioning_label: string;
  hero_description: string;
  long_description: string;
  best_for: string;
  sort_order: number;
  featured: number;
};

export function validateInventoryProduct(
  body: InventoryProductInput,
  allowedCategories: readonly string[],
): { ok: false; error: string } | { ok: true; product: ValidatedInventoryProduct } {
  const slug = slugifyInventory(body.slug ?? body.inventory_name);
  const inventoryName = cleanText(body.inventory_name, 140);
  const category = cleanText(body.category, 40);
  const status = cleanText(body.status ?? "draft", 40);

  if (!slug || !inventoryName) {
    return { ok: false, error: "Product name and a valid slug are required." };
  }
  if (!allowedCategories.includes(category)) {
    const list = allowedCategories.join(", ") || "(none enabled)";
    return { ok: false, error: `Invalid category. This site sells: ${list}.` };
  }
  if (!INVENTORY_STATUSES.includes(status as InventoryStatus)) {
    return {
      ok: false,
      error: "Invalid status. Use draft, available, pending, sold, or hidden.",
    };
  }

  return {
    ok: true,
    product: {
      slug,
      inventory_name: inventoryName,
      category,
      price: numberInRange(body.price, 0, 999999),
      monthly_payment: numberInRange(body.monthly_payment, 0, 99999),
      status: status as InventoryStatus,
      quantity: numberInRange(body.quantity, 0, 999),
      primary_image: cleanInventoryImageUrl(body.primary_image),
      gallery_images: cleanArray(body.gallery_images, 20, 600)
        .map(cleanInventoryImageUrl)
        .filter(Boolean),
      quick_facts: cleanArray(body.quick_facts, 8, 90),
      ghl_tags: cleanArray(body.ghl_tags, 30, 100),
      why_bullets: cleanArray(body.why_bullets, 6, 220),
      promo_label: cleanText(body.promo_label, 80),
      delivery_promise: cleanText(body.delivery_promise, 220),
      headline: cleanText(body.headline, 140),
      positioning_label: cleanText(body.positioning_label, 60),
      hero_description: cleanText(body.hero_description, 320),
      long_description: cleanText(body.long_description, 1400),
      best_for: cleanText(body.best_for, 220),
      sort_order: numberInRange(body.sort_order, -9999, 9999),
      featured: body.featured ? 1 : 0,
    },
  };
}

export type InventoryEnvironmentKind = "preview" | "production";

export type InventoryProductView = ValidatedInventoryProduct & {
  orphaned: boolean;
};
