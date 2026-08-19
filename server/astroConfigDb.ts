import { eq } from "drizzle-orm";
import {
  astroClientConfigs,
  clients,
  wranglerSecretSetups,
  type InsertWranglerSecretSetup,
} from "../drizzle/schema";
import {
  ASTRO_ASSET_SLOT_VALUES,
  ASTRO_CATEGORY_VALUES,
  WRANGLER_SECRET_VALUES,
  astroClientConfigInputSchema,
  createDefaultAstroConfig,
  emptyWranglerSecretStatus,
  generateAstroClientConfig,
  type AstroAssetSlot,
  type AstroClientConfigInput,
  type AstroHomepageSection,
  type AstroHomepageSectionOrder,
  type WranglerSecretName,
} from "../shared/astroConfig";
import { decryptSetupValue, encryptSetupValue } from "./clientSecurity";
import {
  getClientAssets,
  getClientById,
  getDb,
  saveClientSecretSetup,
} from "./db";
import { postgresConflictTargets, withUpdatedAt } from "./postgresPersistence";
import type { ProductCategory } from "../shared/client";
import { getAstroSiteRuntimeSecrets } from "../shared/astroSiteContract";
import {
  clientIntegrationProfileResolverForClient,
  loadOrBackfillResolvedClientIntegrationProfile,
  saveClientIntegrationProfile,
} from "./clientIntegrations";
import { assertAstroSitePublishProfileReady } from "./studio/website/publishProfile";
import {
  isIdentifierKey,
  type ClientIntegrationProfileDto,
  type ClientIntegrationSecretKey,
} from "../shared/clientIntegrationProfile";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

const secretColumnByName = {
  GHL_API_KEY: "ghlApiKeyEncrypted",
  GHL_LOCATION_ID: "ghlLocationIdEncrypted",
  META_PIXEL_ID: "metaPixelIdEncrypted",
  META_CAPI_ACCESS_TOKEN: "metaCapiAccessTokenEncrypted",
  STAGE_WEBHOOK_SECRET: "stageWebhookSecretEncrypted",
  GOOGLE_SHEETS_ID: "googleSheetsIdEncrypted",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "googleServiceAccountEmailEncrypted",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "googleServiceAccountPrivateKeyEncrypted",
  ALERT_WEBHOOK_URL: "alertWebhookUrlEncrypted",
  ADMIN_PASSWORD: "adminPasswordEncrypted",
  ADMIN_SESSION_SECRET: "adminSessionSecretEncrypted",
} as const satisfies Record<WranglerSecretName, keyof InsertWranglerSecretSetup>;

const categoryAssetSlot: Record<(typeof ASTRO_CATEGORY_VALUES)[number], AstroAssetSlot> = {
  "hot-tubs": "categoryHotTubs",
  "swim-spas": "categorySwimSpas",
  saunas: "categorySaunas",
  "cold-plunge": "categoryColdPlunge",
  "massage-chairs": "categoryMassageChairs",
};

const legacyCategoryByAstro = {
  "hot-tubs": "hotTubs",
  "swim-spas": "swimSpas",
  saunas: "saunas",
  "cold-plunge": "coldPlunge",
  "massage-chairs": "massageChairs",
} as const;

export function resolveProductCategories(
  input: AstroClientConfigInput,
  existingCategories: ProductCategory[],
): ProductCategory[] {
  const enabled = ASTRO_CATEGORY_VALUES.filter(category => input.categories[category].enabled).map(
    category => legacyCategoryByAstro[category],
  );
  return enabled.length > 0 ? enabled : existingCategories;
}

function isAstroAssetSlot(value: string): value is AstroAssetSlot {
  return (ASTRO_ASSET_SLOT_VALUES as readonly string[]).includes(value);
}

export function mergeStoredAstroConfig(
  defaults: AstroClientConfigInput,
  row: typeof astroClientConfigs.$inferSelect | undefined,
): AstroClientConfigInput {
  const merged = !row ? defaults : {
    ...defaults,
    socialLinks: { ...defaults.socialLinks, ...row.socialLinks } as AstroClientConfigInput["socialLinks"],
    brand: {
      ...defaults.brand,
      fonts: { ...defaults.brand.fonts, ...row.fonts },
      borderRadii: { ...defaults.brand.borderRadii, ...row.borderRadii },
    },
    navigationItems: row.navigationItems as AstroClientConfigInput["navigationItems"],
    categories: Object.fromEntries(
      ASTRO_CATEGORY_VALUES.map(category => [
        category,
        { ...defaults.categories[category], ...(row.categories[category] ?? {}) },
      ]),
    ) as AstroClientConfigInput["categories"],
    financing: { ...defaults.financing, ...row.financing } as AstroClientConfigInput["financing"],
    homepageSections: row.homepageSections as AstroClientConfigInput["homepageSections"],
    integrations: Object.fromEntries(
      Object.entries(defaults.integrations).map(([name, value]) => [
        name,
        {
          ...value,
          ...(row.integrations[name] ?? {}),
          config: { ...value.config, ...(row.integrations[name]?.config as Record<string, string> | undefined) },
        },
      ]),
    ) as AstroClientConfigInput["integrations"],
  };
  return {
    ...merged,
    integrations: {
      ...merged.integrations,
      ghl: { ...merged.integrations.ghl, config: {} },
      meta: { ...merged.integrations.meta, config: {} },
    },
  };
}

export function applyAstroHomepageSectionOrder(
  existing: AstroHomepageSection[],
  requested: AstroHomepageSectionOrder,
): AstroHomepageSection[] {
  if (requested.length !== existing.length) {
    throw new Error("Homepage section order does not match the saved website configuration.");
  }
  const existingById = new Map(existing.map(section => [section.id, section]));
  if (existingById.size !== existing.length) {
    throw new Error("Saved homepage sections contain duplicate IDs.");
  }
  return requested.map(item => {
    const section = existingById.get(item.id);
    if (!section || section.type !== item.type) {
      throw new Error("Homepage section order does not match the saved website configuration.");
    }
    return { ...section, enabled: item.enabled };
  });
}

export function applyAstroAssetUrls(
  input: AstroClientConfigInput,
  assetUrls: Record<string, string>,
): AstroClientConfigInput {
  return {
    ...input,
    categories: Object.fromEntries(
      ASTRO_CATEGORY_VALUES.map(category => [
        category,
        {
          ...input.categories[category],
          heroImage: assetUrls[categoryAssetSlot[category]] || input.categories[category].heroImage,
        },
      ]),
    ) as AstroClientConfigInput["categories"],
  };
}

export async function getAstroConfigView(clientId: number) {
  const db = await requireDb();
  const [client, configRows, assets, integrationProfile] = await Promise.all([
    getClientById(clientId),
    db.select().from(astroClientConfigs).where(eq(astroClientConfigs.clientId, clientId)).limit(1),
    getClientAssets(clientId),
    loadOrBackfillResolvedClientIntegrationProfile(clientId),
  ]);
  if (!client) throw new Error("Client not found.");

  const defaults = createDefaultAstroConfig({
    ...client,
    foundedYear: client.foundedYear ?? 0,
    tagline: client.tagline ?? "",
    websiteUrl: client.websiteUrl ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    streetAddress: client.streetAddress ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    postalCode: client.postalCode ?? "",
    facebookUrl: client.facebookUrl ?? "",
  });
  const assetUrls = Object.fromEntries(
    assets.filter(asset => isAstroAssetSlot(asset.slot)).map(asset => [asset.slot, asset.storageUrl]),
  );
  const input = applyAstroAssetUrls(mergeStoredAstroConfig(defaults, configRows[0]), assetUrls);
  const secretStatus = wranglerSecretStatusFromProfile(integrationProfile.dto);

  const generatedConfig = configRows[0]?.generatedConfigEncrypted
    ? decryptSetupValue(configRows[0].generatedConfigEncrypted)
    : generateAstroClientConfig(input, assetUrls);

  return {
    clientId,
    input,
    assets: assets.filter(asset => isAstroAssetSlot(asset.slot)),
    secretStatus,
    integrationProfile: integrationProfile.dto,
    generatedConfig,
    generatedAt: configRows[0]?.generatedAt ?? null,
  };
}

export type AstroSitePublishMaterial = {
  generatedConfig: string;
  runtimeSecrets: Record<string, string>;
};

/** Server-only material for the publisher. Never return this through a router. */
export async function getAstroSitePublishMaterial(
  clientId: number,
): Promise<AstroSitePublishMaterial> {
  // Loading the view first also performs the safe, missing-row-only legacy
  // backfill. The resolver then reads the exact same canonical profile.
  const view = await getAstroConfigView(clientId);
  const resolver = await clientIntegrationProfileResolverForClient(clientId);
  const enabledIntegrations = {
    ghl: view.input.integrations.ghl.enabled,
    meta: view.input.integrations.meta.enabled,
  };
  const requiredNames = getAstroSiteRuntimeSecrets(enabledIntegrations);
  const { runtimeSecrets } = assertAstroSitePublishProfileReady({
    clientId,
    resolver,
    requiredSecretNames: requiredNames,
  });
  if (!view.generatedAt) {
    throw new Error("Save the website configuration before publishing.");
  }
  if (!view.generatedConfig.includes('"deployMode": "client"')) {
    throw new Error(
      "Website configuration is not launch-ready. Complete the required client details, assets, hours, coordinates, and at least one category.",
    );
  }
  return { generatedConfig: view.generatedConfig, runtimeSecrets };
}

export async function saveAstroConfig(clientId: number, input: AstroClientConfigInput) {
  const db = await requireDb();
  const existing = await getClientById(clientId);
  if (!existing) throw new Error("Client not found.");
  const assets = await getClientAssets(clientId);
  const assetUrls = Object.fromEntries(
    assets.filter(asset => isAstroAssetSlot(asset.slot)).map(asset => [asset.slot, asset.storageUrl]),
  );
  const normalized = mergeStoredAstroConfig(
    applyAstroAssetUrls(input, assetUrls),
    undefined,
  );
  const generatedConfig = generateAstroClientConfig(normalized, assetUrls);
  const generatedAt = new Date();

  await db.transaction(async transaction => {
    await transaction
      .update(clients)
      .set(withUpdatedAt({
        businessName: normalized.identity.businessName,
        shortName: normalized.identity.shortName,
        foundedYear: normalized.identity.foundedYear,
        tagline: normalized.identity.tagline,
        websiteUrl: normalized.identity.siteUrl,
        schemaType: normalized.identity.schemaType,
        phone: normalized.contact.phone,
        smsPhone: normalized.contact.smsPhone || null,
        phoneDisplayOverride: normalized.contact.phoneDisplayOverride || null,
        email: normalized.contact.email,
        streetAddress: normalized.address.street1,
        street2: normalized.address.street2 || null,
        city: normalized.address.city,
        state: normalized.address.state,
        postalCode: normalized.address.postalCode,
        country: normalized.address.country,
        latitude: normalized.address.latitude || null,
        longitude: normalized.address.longitude || null,
        googlePlaceId: normalized.address.googlePlaceId || null,
        businessHours: normalized.hours,
        facebookUrl: normalized.socialLinks.facebook,
        theme: normalized.brand.theme,
        productCategories: resolveProductCategories(normalized, existing.productCategories),
      }))
      .where(eq(clients.id, clientId));

    await transaction
      .insert(astroClientConfigs)
      .values({
        clientId,
        socialLinks: normalized.socialLinks,
        fonts: normalized.brand.fonts,
        borderRadii: normalized.brand.borderRadii,
        navigationItems: normalized.navigationItems,
        categories: normalized.categories,
        financing: normalized.financing,
        homepageSections: normalized.homepageSections,
        integrations: normalized.integrations,
        generatedConfigEncrypted: encryptSetupValue(generatedConfig),
        generatedAt,
      })
      .onConflictDoUpdate({
        target: postgresConflictTargets.astroClientConfigs,
        set: withUpdatedAt({
          socialLinks: normalized.socialLinks,
          fonts: normalized.brand.fonts,
          borderRadii: normalized.brand.borderRadii,
          navigationItems: normalized.navigationItems,
          categories: normalized.categories,
          financing: normalized.financing,
          homepageSections: normalized.homepageSections,
          integrations: normalized.integrations,
          generatedConfigEncrypted: encryptSetupValue(generatedConfig),
          generatedAt,
        }),
      });
  });

  return getAstroConfigView(clientId);
}

export async function saveAstroHomepageSectionOrder(
  clientId: number,
  requested: AstroHomepageSectionOrder,
) {
  const current = await getAstroConfigView(clientId);
  const input = astroClientConfigInputSchema.parse({
    ...current.input,
    homepageSections: applyAstroHomepageSectionOrder(
      current.input.homepageSections,
      requested,
    ),
  });
  return saveAstroConfig(clientId, input);
}

export async function saveWranglerSecrets(
  clientId: number,
  input: Partial<Record<WranglerSecretName, string>>,
) {
  const db = await requireDb();
  const existingClient = await getClientById(clientId);
  if (!existingClient) throw new Error("Client not found.");
  await loadOrBackfillResolvedClientIntegrationProfile(clientId);
  const updates = protectWranglerSecretValues(input);

  if (Object.keys(updates).length > 0) {
    await db
      .insert(wranglerSecretSetups)
      .values({ clientId, ...updates })
      .onConflictDoUpdate({
        target: postgresConflictTargets.wranglerSecretSetups,
        set: withUpdatedAt(updates),
      });
  }

  const legacyUpdates: Record<string, string> = {};
  if (input.GHL_API_KEY?.trim()) legacyUpdates.ghlApiKeyEncrypted = encryptSetupValue(input.GHL_API_KEY.trim());
  if (input.META_PIXEL_ID?.trim()) legacyUpdates.metaPixelIdEncrypted = encryptSetupValue(input.META_PIXEL_ID.trim());
  if (Object.keys(legacyUpdates).length) await saveClientSecretSetup(clientId, legacyUpdates);

  const identifiers: Partial<Record<"GHL_LOCATION_ID" | "GOOGLE_SHEETS_ID" | "META_PIXEL_ID", string>> = {};
  const replaceSecrets: Partial<Record<ClientIntegrationSecretKey, string>> = {};
  const resolvedKeys: WranglerSecretName[] = [];
  for (const name of WRANGLER_SECRET_VALUES) {
    const value = input[name]?.trim();
    if (!value) continue;
    resolvedKeys.push(name);
    if (isIdentifierKey(name)) identifiers[name] = value;
    else replaceSecrets[name] = value;
  }
  if (resolvedKeys.length > 0) {
    // The canonical row is the source of truth. Legacy rows remain mirrored for
    // compatibility, and explicitly replaced keys resolve only their own
    // reconciliation conflicts without hiding unrelated conflicts.
    await saveClientIntegrationProfile(clientId, {
      identifiers,
      replaceSecrets,
      resolveConflictedKeys: resolvedKeys,
    });
  }

  return getAstroConfigView(clientId);
}

export function wranglerSecretStatusFromProfile(
  profile: ClientIntegrationProfileDto,
): Record<WranglerSecretName, boolean> {
  const status = emptyWranglerSecretStatus();
  for (const name of WRANGLER_SECRET_VALUES) {
    status[name] = isIdentifierKey(name)
      ? Boolean(profile.identifiers[name]?.trim())
      : profile.secretPresence[name] === "SET";
  }
  return status;
}

export function protectWranglerSecretValues(
  input: Partial<Record<WranglerSecretName, string>>,
): Partial<InsertWranglerSecretSetup> {
  const updates: Partial<InsertWranglerSecretSetup> = {};
  for (const name of WRANGLER_SECRET_VALUES) {
    const value = input[name]?.trim();
    if (!value) continue;
    updates[secretColumnByName[name]] = encryptSetupValue(value);
  }
  return updates;
}
