import { eq } from "drizzle-orm";
import {
  astroClientConfigs,
  clients,
  wranglerSecretSetups,
  type InsertWranglerSecretSetup,
  type WranglerSecretSetup,
} from "../drizzle/schema";
import {
  ASTRO_ASSET_SLOT_VALUES,
  ASTRO_CATEGORY_VALUES,
  WRANGLER_SECRET_VALUES,
  createDefaultAstroConfig,
  emptyWranglerSecretStatus,
  generateAstroClientConfig,
  type AstroAssetSlot,
  type AstroClientConfigInput,
  type WranglerSecretName,
} from "../shared/astroConfig";
import { decryptSetupValue, encryptSetupValue, hasProtectedValue } from "./clientSecurity";
import {
  getClientAssets,
  getClientById,
  getClientSecretSetup,
  getDb,
  saveClientSecretSetup,
} from "./db";

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
  META_VALUE_QUALIFIED: "metaValueQualifiedEncrypted",
  META_VALUE_SCHEDULE: "metaValueScheduleEncrypted",
  META_VALUE_SHOWED: "metaValueShowedEncrypted",
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

function isAstroAssetSlot(value: string): value is AstroAssetSlot {
  return (ASTRO_ASSET_SLOT_VALUES as readonly string[]).includes(value);
}

export function mergeStoredAstroConfig(
  defaults: AstroClientConfigInput,
  row: typeof astroClientConfigs.$inferSelect | undefined,
): AstroClientConfigInput {
  if (!row) return defaults;
  return {
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

async function getWranglerSecretRow(clientId: number): Promise<WranglerSecretSetup | undefined> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(wranglerSecretSetups)
    .where(eq(wranglerSecretSetups.clientId, clientId))
    .limit(1);
  return rows[0];
}

export async function getAstroConfigView(clientId: number) {
  const db = await requireDb();
  const [client, configRows, assets, wranglerRow, legacySecrets] = await Promise.all([
    getClientById(clientId),
    db.select().from(astroClientConfigs).where(eq(astroClientConfigs.clientId, clientId)).limit(1),
    getClientAssets(clientId),
    getWranglerSecretRow(clientId),
    getClientSecretSetup(clientId),
  ]);
  if (!client) throw new Error("Client not found.");

  const defaults = createDefaultAstroConfig(client);
  const assetUrls = Object.fromEntries(
    assets.filter(asset => isAstroAssetSlot(asset.slot)).map(asset => [asset.slot, asset.storageUrl]),
  );
  const input = applyAstroAssetUrls(mergeStoredAstroConfig(defaults, configRows[0]), assetUrls);
  const secretStatus = emptyWranglerSecretStatus();
  for (const name of WRANGLER_SECRET_VALUES) {
    const column = secretColumnByName[name];
    secretStatus[name] = hasProtectedValue(wranglerRow?.[column] as string | null | undefined);
  }
  secretStatus.GHL_API_KEY ||= hasProtectedValue(legacySecrets?.ghlApiKeyEncrypted);
  secretStatus.META_PIXEL_ID ||= hasProtectedValue(legacySecrets?.metaPixelIdEncrypted);

  const generatedConfig = configRows[0]?.generatedConfigEncrypted
    ? decryptSetupValue(configRows[0].generatedConfigEncrypted)
    : generateAstroClientConfig(input, assetUrls);

  return {
    clientId,
    input,
    assets: assets.filter(asset => isAstroAssetSlot(asset.slot)),
    secretStatus,
    generatedConfig,
    generatedAt: configRows[0]?.generatedAt ?? null,
  };
}

export async function saveAstroConfig(clientId: number, input: AstroClientConfigInput) {
  const db = await requireDb();
  const existing = await getClientById(clientId);
  if (!existing) throw new Error("Client not found.");
  const assets = await getClientAssets(clientId);
  const assetUrls = Object.fromEntries(
    assets.filter(asset => isAstroAssetSlot(asset.slot)).map(asset => [asset.slot, asset.storageUrl]),
  );
  const normalized = applyAstroAssetUrls(input, assetUrls);
  const generatedConfig = generateAstroClientConfig(normalized, assetUrls);
  const generatedAt = new Date();

  await db.transaction(async transaction => {
    await transaction
      .update(clients)
      .set({
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
        productCategories: ASTRO_CATEGORY_VALUES.filter(category => normalized.categories[category].enabled).map(category => legacyCategoryByAstro[category]),
      })
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
      .onDuplicateKeyUpdate({
        set: {
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
        },
      });
  });

  return getAstroConfigView(clientId);
}

export async function saveWranglerSecrets(
  clientId: number,
  input: Partial<Record<WranglerSecretName, string>>,
) {
  const db = await requireDb();
  const existingClient = await getClientById(clientId);
  if (!existingClient) throw new Error("Client not found.");
  const updates = protectWranglerSecretValues(input);

  if (Object.keys(updates).length > 0) {
    await db
      .insert(wranglerSecretSetups)
      .values({ clientId, ...updates })
      .onDuplicateKeyUpdate({ set: updates });
  }

  const legacyUpdates: Record<string, string> = {};
  if (input.GHL_API_KEY?.trim()) legacyUpdates.ghlApiKeyEncrypted = encryptSetupValue(input.GHL_API_KEY.trim());
  if (input.META_PIXEL_ID?.trim()) legacyUpdates.metaPixelIdEncrypted = encryptSetupValue(input.META_PIXEL_ID.trim());
  if (Object.keys(legacyUpdates).length) await saveClientSecretSetup(clientId, legacyUpdates);

  return getAstroConfigView(clientId);
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
