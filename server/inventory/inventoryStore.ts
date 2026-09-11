import { getAstroConfigView } from "../astroConfigDb";
import { astroSitePreviewStore } from "../preview/astroSitePreviewDb";
import { astroSitePublishStore } from "../publisher/astroSitePublishDb";
import {
  createCloudflareApiClient,
  type CloudflareApiClient,
} from "../publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "../publisher/publisherEnv";
import {
  enabledInventoryCategories,
  INVENTORY_PATCH_STATUSES,
  slugifyInventory,
  validateInventoryProduct,
  type InventoryEnvironmentKind,
  type InventoryProductInput,
  type InventoryProductView,
  type ValidatedInventoryProduct,
} from "../../shared/inventoryAdmin";
function adminUrlFromSite(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    const url = new URL(siteUrl);
    url.pathname = "/admin";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const PRODUCT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  inventory_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  price INTEGER NOT NULL DEFAULT 0,
  monthly_payment INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  primary_image TEXT NOT NULL DEFAULT '',
  gallery_images TEXT NOT NULL DEFAULT '[]',
  quick_facts TEXT NOT NULL DEFAULT '[]',
  why_bullets TEXT NOT NULL DEFAULT '[]',
  ghl_tags TEXT NOT NULL DEFAULT '[]',
  promo_label TEXT NOT NULL DEFAULT '',
  delivery_promise TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  positioning_label TEXT NOT NULL DEFAULT '',
  hero_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  best_for TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export type InventoryTarget = {
  kind: InventoryEnvironmentKind;
  label: string;
  d1DatabaseId: string;
  r2BucketName: string;
  r2PublicUrl: string | null;
  siteUrl: string | null;
  adminUrl: string | null;
  ready: boolean;
};

export type InventoryWorkspace = {
  environment: InventoryEnvironmentKind;
  targets: InventoryTarget[];
  categories: { slug: string; label: string }[];
  d1Enabled: boolean;
  r2Enabled: boolean;
  blockedBy: string | null;
};

export type InventoryDependencies = {
  loadWorkspace(clientId: number): Promise<InventoryWorkspace>;
  query(
    target: InventoryTarget,
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; changes: number }>;
  uploadImage(
    target: InventoryTarget,
    input: { filename: string; mimeType: string; bytes: Buffer },
  ): Promise<{ url: string }>;
};

function parseJsonArray(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toProductView(
  row: Record<string, unknown>,
  allowed: readonly string[],
): InventoryProductView {
  return {
    slug: String(row.slug ?? ""),
    inventory_name: String(row.inventory_name ?? ""),
    category: String(row.category ?? ""),
    price: Number(row.price ?? 0),
    monthly_payment: Number(row.monthly_payment ?? 0),
    status: (String(row.status ?? "draft") as InventoryProductView["status"]),
    quantity: Number(row.quantity ?? 0),
    primary_image: String(row.primary_image ?? ""),
    gallery_images: parseJsonArray(row.gallery_images),
    quick_facts: parseJsonArray(row.quick_facts),
    ghl_tags: parseJsonArray(row.ghl_tags),
    why_bullets: parseJsonArray(row.why_bullets),
    promo_label: String(row.promo_label ?? ""),
    delivery_promise: String(row.delivery_promise ?? ""),
    headline: String(row.headline ?? ""),
    positioning_label: String(row.positioning_label ?? ""),
    hero_description: String(row.hero_description ?? ""),
    long_description: String(row.long_description ?? ""),
    best_for: String(row.best_for ?? ""),
    sort_order: Number(row.sort_order ?? 0),
    featured: Number(row.featured ?? 0) ? 1 : 0,
    orphaned: !allowed.includes(String(row.category ?? "")),
  };
}

export function pickInventoryTarget(
  workspace: InventoryWorkspace,
  preferred?: InventoryEnvironmentKind,
): InventoryTarget | null {
  if (preferred) {
    return workspace.targets.find(target => target.kind === preferred) ?? null;
  }
  return (
    workspace.targets.find(target => target.kind === "production") ??
    workspace.targets[0] ??
    null
  );
}

export async function ensureInventorySchema(
  deps: InventoryDependencies,
  target: InventoryTarget,
): Promise<void> {
  await deps.query(target, PRODUCT_TABLE_SQL);
}

export async function listInventoryProducts(
  deps: InventoryDependencies,
  workspace: InventoryWorkspace,
  target: InventoryTarget,
): Promise<InventoryProductView[]> {
  await ensureInventorySchema(deps, target);
  const allowed = workspace.categories.map(category => category.slug);
  const { rows } = await deps.query(
    target,
    "SELECT * FROM products WHERE status != 'deleted' ORDER BY featured DESC, sort_order ASC, id ASC",
  );
  return rows.map(row => toProductView(row, allowed));
}

export function prepareInventorySave(
  workspace: InventoryWorkspace,
  body: InventoryProductInput,
): { ok: false; error: string } | { ok: true; product: ValidatedInventoryProduct } {
  return validateInventoryProduct(
    body,
    workspace.categories.map(category => category.slug),
  );
}

export async function saveInventoryProduct(
  deps: InventoryDependencies,
  workspace: InventoryWorkspace,
  target: InventoryTarget,
  body: InventoryProductInput,
): Promise<ValidatedInventoryProduct> {
  const validated = prepareInventorySave(workspace, body);
  if (!validated.ok) throw new Error(validated.error);
  const product = validated.product;
  await ensureInventorySchema(deps, target);
  const now = Date.now();
  await deps.query(
    target,
    `INSERT INTO products (
       slug, inventory_name, category, price, monthly_payment, status, quantity,
       primary_image, gallery_images, quick_facts, ghl_tags, why_bullets,
       promo_label, delivery_promise, headline, positioning_label,
       hero_description, long_description, best_for, sort_order, featured,
       created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       inventory_name=excluded.inventory_name, category=excluded.category,
       price=excluded.price, monthly_payment=excluded.monthly_payment,
       status=excluded.status, quantity=excluded.quantity,
       primary_image=excluded.primary_image, gallery_images=excluded.gallery_images,
       quick_facts=excluded.quick_facts, ghl_tags=excluded.ghl_tags,
       why_bullets=excluded.why_bullets, promo_label=excluded.promo_label,
       delivery_promise=excluded.delivery_promise, headline=excluded.headline,
       positioning_label=excluded.positioning_label, hero_description=excluded.hero_description,
       long_description=excluded.long_description, best_for=excluded.best_for,
       sort_order=excluded.sort_order, featured=excluded.featured,
       updated_at=excluded.updated_at`,
    [
      product.slug,
      product.inventory_name,
      product.category,
      product.price,
      product.monthly_payment,
      product.status,
      product.quantity,
      product.primary_image,
      JSON.stringify(product.gallery_images),
      JSON.stringify(product.quick_facts),
      JSON.stringify(product.ghl_tags),
      JSON.stringify(product.why_bullets),
      product.promo_label,
      product.delivery_promise,
      product.headline,
      product.positioning_label,
      product.hero_description,
      product.long_description,
      product.best_for,
      product.sort_order,
      product.featured,
      now,
      now,
    ],
  );
  return product;
}

export async function setInventoryStatus(
  deps: InventoryDependencies,
  target: InventoryTarget,
  slugValue: unknown,
  statusValue: unknown,
): Promise<void> {
  const slug = slugifyInventory(slugValue);
  const status = String(statusValue ?? "").trim();
  if (!slug || !INVENTORY_PATCH_STATUSES.includes(status as (typeof INVENTORY_PATCH_STATUSES)[number])) {
    throw new Error("A valid slug and status are required.");
  }
  await ensureInventorySchema(deps, target);
  const result = await deps.query(
    target,
    "UPDATE products SET status = ?, updated_at = ? WHERE slug = ?",
    [status, Date.now(), slug],
  );
  if (result.changes === 0) throw new Error("Product not found.");
}

function imageExtension(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return null;
  }
}

export function inventoryImageKey(filename: string, mimeType: string): string {
  const extension = imageExtension(mimeType);
  if (!extension) throw new Error("Only JPG, PNG, WEBP, and GIF images are allowed.");
  const stem = slugifyInventory(filename.replace(/\.[^.]+$/, "")) || "image";
  return `products/${Date.now()}-${stem}${extension}`;
}

export async function loadInventoryWorkspace(clientId: number): Promise<InventoryWorkspace> {
  const [view, preview, publish] = await Promise.all([
    getAstroConfigView(clientId),
    astroSitePreviewStore.getLatest(clientId),
    astroSitePublishStore.get(clientId),
  ]);
  const categories = enabledInventoryCategories(view.input);
  const d1Enabled = view.input.integrations.d1.enabled;
  const r2Enabled = view.input.integrations.r2.enabled;
  const targets: InventoryTarget[] = [];

  if (publish?.d1DatabaseId && publish.r2BucketName) {
    const siteUrl = publish.liveUrl ?? null;
    targets.push({
      kind: "production",
      label: "Live website",
      d1DatabaseId: publish.d1DatabaseId,
      r2BucketName: publish.r2BucketName,
      r2PublicUrl: publish.r2PublicUrl ?? null,
      siteUrl,
      adminUrl: adminUrlFromSite(siteUrl),
      ready: publish.status === "published",
    });
  }
  if (preview?.d1DatabaseId && preview.r2BucketName) {
    const siteUrl = preview.previewUrl ?? null;
    targets.push({
      kind: "preview",
      label: "Preview website",
      d1DatabaseId: preview.d1DatabaseId,
      r2BucketName: preview.r2BucketName,
      r2PublicUrl: preview.r2PublicUrl ?? null,
      siteUrl,
      adminUrl: adminUrlFromSite(siteUrl),
      ready: preview.status === "ready",
    });
  }

  let blockedBy: string | null = null;
  if (!d1Enabled || !r2Enabled) {
    blockedBy = "Turn on Cloudflare D1 and R2 in Configuration → Technical.";
  } else if (targets.length === 0) {
    blockedBy = "Generate a preview or publish the website so inventory has a database.";
  } else if (categories.length === 0) {
    blockedBy = "Turn on at least one product category in Configuration → Content.";
  }

  return {
    environment: pickInventoryTarget({
      environment: "production",
      targets,
      categories,
      d1Enabled,
      r2Enabled,
      blockedBy,
    })?.kind ?? "preview",
    targets,
    categories,
    d1Enabled,
    r2Enabled,
    blockedBy,
  };
}

export function createLiveInventoryDependencies(
  cloudflare: CloudflareApiClient = createCloudflareApiClient(
    getCloudflarePublisherEnvironment(),
  ),
): InventoryDependencies {
  return {
    loadWorkspace: loadInventoryWorkspace,
    async query(target, sql, params) {
      return cloudflare.queryD1({
        databaseId: target.d1DatabaseId,
        sql,
        params,
        signal: AbortSignal.timeout(15_000),
      });
    },
    async uploadImage(target, input) {
      if (!target.r2PublicUrl) {
        throw new Error(
          "Image hosting is not ready yet. Generate a preview or publish, then try again.",
        );
      }
      if (input.bytes.length > 6 * 1024 * 1024) {
        throw new Error("Choose an image file smaller than 6 MB.");
      }
      const key = inventoryImageKey(input.filename, input.mimeType);
      await cloudflare.putR2Object({
        bucket: target.r2BucketName,
        key,
        body: input.bytes,
        contentType: input.mimeType,
        signal: AbortSignal.timeout(20_000),
      });
      return { url: `${target.r2PublicUrl.replace(/\/$/, "")}/${key}` };
    },
  };
}
