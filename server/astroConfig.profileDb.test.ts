import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  astroClientConfigs,
  clientIntegrationProfiles,
  clientLeadIntegrations,
  clientSecretSetups,
  funnels,
  wranglerSecretSetups,
} from "../drizzle/schema";
import { BUSINESS_DAY_VALUES } from "../shared/client";
import { createDefaultAstroConfig, WRANGLER_SECRET_VALUES } from "../shared/astroConfig";
import { encryptSetupValue } from "./clientSecurity";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getClientById: vi.fn(),
  getClientAssets: vi.fn(),
  getClientSecretSetup: vi.fn(),
  saveClientSecretSetup: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import {
  getAstroConfigView,
  getAstroSitePublishMaterial,
  saveWranglerSecrets,
} from "./astroConfigDb";
import { saveClientIntegrationProfile } from "./clientIntegrations";

type TestState = {
  astro: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  wrangler: Record<string, unknown>;
  clientSecrets: Record<string, unknown> | null;
};

function databaseFor(state: TestState) {
  const rowsFor = (table: unknown) => {
    if (table === astroClientConfigs) return [state.astro];
    if (table === clientIntegrationProfiles) return state.profile ? [state.profile] : [];
    if (table === wranglerSecretSetups) return [state.wrangler];
    if (table === clientLeadIntegrations) return [];
    if (table === clientSecretSetups) return state.clientSecrets ? [state.clientSecrets] : [];
    throw new Error("Unexpected table read in Astro profile test.");
  };

  const database = {
    select: () => ({
      from: (table: unknown) => {
        if (table === funnels) {
          return {
            leftJoin: () => ({ where: async () => [] }),
          };
        }
        return {
          where: () => ({ limit: async () => rowsFor(table) }),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          if (table !== clientIntegrationProfiles) {
            throw new Error("Unexpected conflict-safe write in Astro profile test.");
          }
          if (!state.profile) {
            state.profile = {
              ...value,
              createdAt: new Date("2026-08-18T12:00:00.000Z"),
              updatedAt: new Date("2026-08-18T12:00:00.000Z"),
            };
          }
        },
        onConflictDoUpdate: async ({ set }: { set: Record<string, unknown> }) => {
          if (table === clientIntegrationProfiles) {
            state.profile = {
              ...(state.profile ?? {}),
              ...value,
              ...set,
              createdAt: state.profile?.createdAt ?? new Date("2026-08-18T12:00:00.000Z"),
              updatedAt: new Date("2026-08-18T12:05:00.000Z"),
            };
            return;
          }
          if (table === wranglerSecretSetups) {
            state.wrangler = { ...state.wrangler, ...value, ...set };
            return;
          }
          throw new Error("Unexpected table write in Astro profile test.");
        },
      }),
    }),
  };
  return {
    ...database,
    transaction: async (
      callback: (transaction: {
        select: () => {
          from: (table: unknown) => {
            where: () => { for: (mode: "update") => Promise<Record<string, unknown>[]> };
          };
        };
        insert: typeof database.insert;
      }) => Promise<void>,
    ) =>
      callback({
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              for: async (mode: "update") => {
                expect(mode).toBe("update");
                return rowsFor(table);
              },
            }),
          }),
        }),
        insert: database.insert,
      }),
  };
}

describe("Astro canonical integration profile database flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    process.env.SECRETS_ENCRYPTION_KEY = "dedicated-test-encryption-key";
    process.env.NODE_ENV = "test";
  });

  it("backfills legacy values, saves canonically, returns presence only, and publishes from that profile", async () => {
    const raw = {
      GHL_API_KEY: "ghl-original-secret",
      GHL_LOCATION_ID: "location-123",
      META_PIXEL_ID: "123456789012345",
      META_CAPI_ACCESS_TOKEN: "meta-capi-secret",
      STAGE_WEBHOOK_SECRET: "stage-webhook-secret",
      GOOGLE_SHEETS_ID: "sheet-123",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "private-key-secret",
      ADMIN_PASSWORD: "admin-password-secret",
      ADMIN_SESSION_SECRET: "admin-session-secret",
    } as const;
    const defaultConfig = createDefaultAstroConfig({
      businessName: "Test Spas",
      shortName: "test-spas",
      foundedYear: 2001,
      tagline: "Relax better",
      websiteUrl: "https://test.example.com",
      phone: "+17015551234",
      email: "hello@test.example.com",
      streetAddress: "1 Main Street",
      city: "Minot",
      state: "ND",
      postalCode: "58701",
      country: "US",
      businessHours: BUSINESS_DAY_VALUES.map(day => ({
        day,
        isOpen: false,
        opensAt: "",
        closesAt: "",
      })),
      facebookUrl: "",
      theme: "aqua",
    });
    defaultConfig.integrations.ghl = { enabled: true, config: {} };
    defaultConfig.integrations.meta = { enabled: true, config: {} };

    const state: TestState = {
      profile: null,
      clientSecrets: null,
      wrangler: {
        clientId: 5,
        ghlApiKeyEncrypted: encryptSetupValue(raw.GHL_API_KEY),
        ghlLocationIdEncrypted: encryptSetupValue(raw.GHL_LOCATION_ID),
        metaPixelIdEncrypted: encryptSetupValue(raw.META_PIXEL_ID),
        metaCapiAccessTokenEncrypted: encryptSetupValue(raw.META_CAPI_ACCESS_TOKEN),
        metaValueQualifiedEncrypted: encryptSetupValue("legacy-qualified-value-unused"),
        metaValueScheduleEncrypted: encryptSetupValue("legacy-schedule-value-unused"),
        metaValueShowedEncrypted: encryptSetupValue("legacy-showed-value-unused"),
        stageWebhookSecretEncrypted: encryptSetupValue(raw.STAGE_WEBHOOK_SECRET),
        googleSheetsIdEncrypted: encryptSetupValue(raw.GOOGLE_SHEETS_ID),
        googleServiceAccountEmailEncrypted: encryptSetupValue(raw.GOOGLE_SERVICE_ACCOUNT_EMAIL),
        googleServiceAccountPrivateKeyEncrypted: encryptSetupValue(raw.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
        adminPasswordEncrypted: encryptSetupValue(raw.ADMIN_PASSWORD),
        adminSessionSecretEncrypted: encryptSetupValue(raw.ADMIN_SESSION_SECRET),
      },
      astro: {
        clientId: 5,
        socialLinks: defaultConfig.socialLinks,
        fonts: defaultConfig.brand.fonts,
        borderRadii: defaultConfig.brand.borderRadii,
        navigationItems: defaultConfig.navigationItems,
        categories: defaultConfig.categories,
        financing: defaultConfig.financing,
        homepageSections: defaultConfig.homepageSections,
        integrations: defaultConfig.integrations,
        generatedConfigEncrypted: encryptSetupValue('export const config = { "deployMode": "client" };'),
        generatedAt: new Date("2026-08-18T12:00:00.000Z"),
      },
    };

    dbMocks.getDb.mockResolvedValue(databaseFor(state));
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Test Spas",
      shortName: "test-spas",
      foundedYear: 2001,
      tagline: "Relax better",
      websiteUrl: "https://test.example.com",
      schemaType: "LocalBusiness",
      phone: "+17015551234",
      smsPhone: null,
      phoneDisplayOverride: null,
      email: "hello@test.example.com",
      streetAddress: "1 Main Street",
      street2: null,
      city: "Minot",
      state: "ND",
      postalCode: "58701",
      country: "US",
      latitude: null,
      longitude: null,
      googlePlaceId: null,
      businessHours: defaultConfig.hours,
      facebookUrl: "",
      theme: "aqua",
      productCategories: [],
    });
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientSecretSetup.mockImplementation(async () => state.clientSecrets);
    dbMocks.saveClientSecretSetup.mockImplementation(async (_clientId, update) => {
      state.clientSecrets = { ...(state.clientSecrets ?? {}), ...update, clientId: 5 };
    });

    const backfilled = await getAstroConfigView(5);
    expect(state.profile).not.toBeNull();
    expect(backfilled.integrationProfile.readiness.websiteReady).toBe(true);
    expect(Object.values(backfilled.secretStatus).every(Boolean)).toBe(false);
    expect(backfilled.secretStatus.ALERT_WEBHOOK_URL).toBe(false);
    for (const name of WRANGLER_SECRET_VALUES.filter(name => name !== "ALERT_WEBHOOK_URL")) {
      expect(backfilled.secretStatus[name]).toBe(true);
    }
    expect(JSON.stringify(backfilled.integrationProfile)).not.toContain(raw.GHL_API_KEY);
    expect(JSON.stringify(backfilled.integrationProfile)).not.toContain(raw.ADMIN_PASSWORD);
    expect(JSON.stringify(backfilled.integrationProfile)).not.toContain("META_VALUE_");
    expect(JSON.stringify(backfilled.integrationProfile)).not.toContain("legacy-qualified-value-unused");
    expect(backfilled.secretStatus).not.toHaveProperty("META_VALUE_QUALIFIED");
    expect(backfilled.secretStatus).not.toHaveProperty("META_VALUE_SCHEDULE");
    expect(backfilled.secretStatus).not.toHaveProperty("META_VALUE_SHOWED");

    const rotated = "ghl-rotated-secret";
    const saved = await saveWranglerSecrets(5, { GHL_API_KEY: rotated });
    expect(saved.integrationProfile.secretPresence.GHL_API_KEY).toBe("SET");
    expect(JSON.stringify(saved.integrationProfile)).not.toContain(rotated);

    const canonicalOnlyRotation = "canonical-editor-rotation";
    await saveClientIntegrationProfile(5, {
      expectedUpdatedAt: saved.integrationProfile.lastUpdated,
      replaceSecrets: { GHL_API_KEY: canonicalOnlyRotation },
      resolveConflictedKeys: ["GHL_API_KEY"],
    });

    const material = await getAstroSitePublishMaterial(5);
    expect(material.runtimeSecrets.GHL_API_KEY).toBe(canonicalOnlyRotation);
    expect(material.runtimeSecrets.GHL_LOCATION_ID).toBe(raw.GHL_LOCATION_ID);
    expect(material.runtimeSecrets.META_CAPI_ACCESS_TOKEN).toBe(raw.META_CAPI_ACCESS_TOKEN);
  });
});
