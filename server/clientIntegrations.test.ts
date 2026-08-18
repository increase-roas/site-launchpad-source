import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSetupValue } from "./clientSecurity";
import {
  CLIENT_INTEGRATION_SECRET_KEYS,
  assertDtoOmitsSecretValues,
  emptyIdentifiers,
} from "../shared/clientIntegrationProfile";

const originalSecret = process.env.JWT_SECRET;
const originalDedicated = process.env.SECRETS_ENCRYPTION_KEY;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
  process.env.SECRETS_ENCRYPTION_KEY = "dedicated-test-encryption-key";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
  process.env.SECRETS_ENCRYPTION_KEY = originalDedicated;
  process.env.NODE_ENV = originalNodeEnv;
});

import {
  cloneClientIntegrationProfile,
  contributionsFromLegacyRows,
  encryptSecretBlob,
  readinessForSurfaces,
  reconcileContributions,
  resolvePublisherMappings,
  secretPresenceFromBlob,
  toProfileDto,
} from "./clientIntegrations";

const SECRET_VALUES = {
  GHL_API_KEY: "ghl-live-api-key-AAA",
  META_CAPI_ACCESS_TOKEN: "meta-capi-token-BBB",
  STAGE_WEBHOOK_SECRET: "stage-webhook-secret-CCC",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@example.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----secret",
  ALERT_WEBHOOK_URL: "https://alerts.example/hook",
  ADMIN_PASSWORD: "admin-password-XYZ",
  ADMIN_SESSION_SECRET: "admin-session-secret-XYZ",
  META_VALUE_QUALIFIED: "meta-qualified-value-50",
  META_VALUE_SCHEDULE: "meta-schedule-value-75",
  META_VALUE_SHOWED: "meta-showed-value-100",
} as const;

function fullSecrets() {
  return { ...SECRET_VALUES };
}

describe("ClientIntegrationProfile store and DTOs", () => {
  it("enters once and marks website plus two funnels SET", () => {
    const blob = encryptSecretBlob(fullSecrets());
    const dto = toProfileDto(
      {
        clientId: 5,
        profileVersion: 1,
        ghlLocationId: "loc_1",
        googleSheetsId: "sheet_1",
        metaPixelId: "123456789012345",
        secretsEncrypted: blob,
        reconciliationStatus: "ready",
        conflictedKeys: [],
        createdAt: new Date("2026-08-18T06:00:00.000Z"),
        updatedAt: new Date("2026-08-18T06:00:00.000Z"),
      },
      5,
    );
    const surfaces = readinessForSurfaces(dto);
    expect(surfaces.websiteReady).toBe(true);
    expect(surfaces.funnelAReady).toBe(true);
    expect(surfaces.funnelBReady).toBe(true);
    expect(dto.secretPresence.GHL_API_KEY).toBe("SET");
    expect(dto.secretPresence.ADMIN_PASSWORD).toBe("SET");
    assertDtoOmitsSecretValues(dto, Object.values(SECRET_VALUES));
  });

  it("updates shared website and funnel readiness after rotation", () => {
    const before = fullSecrets();
    const after = { ...before, META_CAPI_ACCESS_TOKEN: "meta-capi-token-ROTATED" };
    const beforeDto = toProfileDto(
      {
        clientId: 5,
        profileVersion: 1,
        ghlLocationId: "loc_1",
        googleSheetsId: "sheet_1",
        metaPixelId: "123456789012345",
        secretsEncrypted: encryptSecretBlob(before),
        reconciliationStatus: "ready",
        conflictedKeys: [],
        createdAt: new Date("2026-08-18T06:00:00.000Z"),
        updatedAt: new Date("2026-08-18T06:00:00.000Z"),
      },
      5,
    );
    const afterDto = toProfileDto(
      {
        clientId: 5,
        profileVersion: 1,
        ghlLocationId: "loc_1",
        googleSheetsId: "sheet_1",
        metaPixelId: "123456789012345",
        secretsEncrypted: encryptSecretBlob(after),
        reconciliationStatus: "ready",
        conflictedKeys: [],
        createdAt: new Date("2026-08-18T06:00:00.000Z"),
        updatedAt: new Date("2026-08-18T06:10:00.000Z"),
      },
      5,
    );
    expect(readinessForSurfaces(beforeDto).websiteReady).toBe(true);
    expect(readinessForSurfaces(afterDto).funnelAReady).toBe(true);
    expect(readinessForSurfaces(afterDto).funnelBReady).toBe(true);
    expect(afterDto.lastUpdated?.getTime()).toBeGreaterThan(beforeDto.lastUpdated?.getTime() ?? 0);
    expect(afterDto.secretPresence.META_CAPI_ACCESS_TOKEN).toBe("SET");
    assertDtoOmitsSecretValues(afterDto, [...Object.values(SECRET_VALUES), "meta-capi-token-ROTATED"]);
  });

  it("does not copy secrets on a cross-client clone", () => {
    const source = {
      clientId: 5,
      profileVersion: 1,
      ghlLocationId: "loc_1",
      googleSheetsId: "sheet_1",
      metaPixelId: "123456789012345",
      secretsEncrypted: encryptSecretBlob(fullSecrets()),
      reconciliationStatus: "ready" as const,
      conflictedKeys: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const same = cloneClientIntegrationProfile({
      source,
      sourceClientId: 5,
      targetClientId: 5,
      sameCustomer: true,
    });
    const cross = cloneClientIntegrationProfile({
      source,
      sourceClientId: 5,
      targetClientId: 22,
      sameCustomer: false,
    });
    expect(same.clientId).toBe(5);
    expect(same.copiesSecrets).toBe(false);
    expect(same.dto.secretPresence.GHL_API_KEY).toBe("SET");
    expect(cross.clientId).toBe(22);
    expect(cross.copiesSecrets).toBe(false);
    expect(cross.dto.identifiers).toEqual(emptyIdentifiers());
    expect(cross.dto.secretPresence.GHL_API_KEY).toBe("NOT SET");
    expect(readinessForSurfaces(cross.dto).websiteReady).toBe(false);
    assertDtoOmitsSecretValues(cross.dto, Object.values(SECRET_VALUES));
    expect(JSON.stringify(cross.dto)).not.toContain("ghl-live-api-key-AAA");
  });

  it("omits secret keys and values from API DTOs", () => {
    const dto = toProfileDto(
      {
        clientId: 9,
        profileVersion: 1,
        ghlLocationId: "loc_9",
        googleSheetsId: "sheet_9",
        metaPixelId: "999000111",
        secretsEncrypted: encryptSecretBlob(fullSecrets()),
        reconciliationStatus: "ready",
        conflictedKeys: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      9,
    );
    const json = JSON.stringify(dto);
    for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
      expect(Object.keys(dto)).not.toContain(key);
    }
    expect(json).not.toMatch(/Encrypted|BEGIN PRIVATE KEY|ghl-live-api-key/);
    expect(dto.secretPresence.GHL_API_KEY).toBe("SET");
    expect(dto.secretPresence.ALERT_WEBHOOK_URL).toBe("SET");
    assertDtoOmitsSecretValues(dto, Object.values(SECRET_VALUES));
  });

  it("fail-closes migration when existing scoped secrets conflict", () => {
    const logs: unknown[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args);
    });
    const contributions = contributionsFromLegacyRows({
      clientId: 5,
      lead: {
        ghlLocationId: "loc_1",
        googleSheetsId: "sheet_1",
        metaPixelId: "123456789012345",
        ghlApiKeyEncrypted: encryptSetupValue("ghl-from-lead"),
        metaCapiAccessTokenEncrypted: encryptSetupValue("meta-capi-token-BBB"),
        stageWebhookSecretEncrypted: encryptSetupValue("stage-webhook-secret-CCC"),
      },
      wrangler: {
        ghlApiKeyEncrypted: encryptSetupValue("ghl-from-wrangler"),
        ghlLocationIdEncrypted: encryptSetupValue("loc_1"),
        googleSheetsIdEncrypted: encryptSetupValue("sheet_1"),
        metaPixelIdEncrypted: encryptSetupValue("123456789012345"),
        metaCapiAccessTokenEncrypted: encryptSetupValue("meta-capi-token-BBB"),
        stageWebhookSecretEncrypted: encryptSetupValue("stage-webhook-secret-CCC"),
      },
    });
    const reconciled = reconcileContributions(contributions);
    expect(reconciled.status).toBe("conflict");
    expect(reconciled.conflictedKeys).toEqual(["GHL_API_KEY"]);
    expect(reconciled.acceptedSecrets.GHL_API_KEY).toBeUndefined();
    expect(reconciled.acceptedSecrets.META_CAPI_ACCESS_TOKEN).toBe("meta-capi-token-BBB");
    const dto = toProfileDto(
      {
        clientId: 5,
        profileVersion: 1,
        ghlLocationId: reconciled.identifiers.GHL_LOCATION_ID,
        googleSheetsId: reconciled.identifiers.GOOGLE_SHEETS_ID,
        metaPixelId: reconciled.identifiers.META_PIXEL_ID,
        secretsEncrypted: encryptSecretBlob(reconciled.acceptedSecrets),
        reconciliationStatus: reconciled.status,
        conflictedKeys: reconciled.conflictedKeys,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      5,
    );
    expect(dto.reconciliationStatus).toBe("conflict");
    expect(dto.secretPresence.GHL_API_KEY).toBe("NOT SET");
    expect(readinessForSurfaces(dto).websiteReady).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("ghl-from-lead");
    expect(JSON.stringify(dto)).not.toContain("ghl-from-wrangler");
    expect(JSON.stringify(reconciled.conflictedKeys)).not.toContain("ghl-from");
    expect(JSON.stringify(logs)).not.toContain("ghl-from-lead");
    spy.mockRestore();
  });

  it("maps legacy GHL_WEBHOOK_URL and CRM_CALLBACK_SECRET without exposing values", () => {
    const contributions = contributionsFromLegacyRows({
      clientId: 5,
      funnelSecrets: [
        {
          funnelId: 11,
          row: {
            ghlWebhookUrlEncrypted: encryptSetupValue("ghl-live-api-key-AAA"),
            crmCallbackSecretEncrypted: encryptSetupValue("stage-webhook-secret-CCC"),
          },
        },
      ],
    });
    const reconciled = reconcileContributions(contributions);
    expect(reconciled.status).toBe("ready");
    expect(reconciled.acceptedSecrets.GHL_API_KEY).toBe("ghl-live-api-key-AAA");
    expect(reconciled.acceptedSecrets.STAGE_WEBHOOK_SECRET).toBe("stage-webhook-secret-CCC");
    const dto = toProfileDto(
      {
        clientId: 5,
        profileVersion: 1,
        ghlLocationId: null,
        googleSheetsId: null,
        metaPixelId: null,
        secretsEncrypted: encryptSecretBlob(reconciled.acceptedSecrets),
        reconciliationStatus: reconciled.status,
        conflictedKeys: reconciled.conflictedKeys,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      5,
    );
    expect(JSON.stringify(dto)).not.toContain("GHL_WEBHOOK_URL");
    expect(JSON.stringify(dto)).not.toContain("CRM_CALLBACK_SECRET");
    assertDtoOmitsSecretValues(dto, Object.values(SECRET_VALUES));
  });

  it("gives publisher mappings values without logging them", () => {
    const logs: unknown[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args) => logs.push(args));
    const info = vi.spyOn(console, "info").mockImplementation((...args) => logs.push(args));
    const blob = encryptSecretBlob(fullSecrets());
    const mappings = resolvePublisherMappings(blob);
    expect(mappings.GHL_API_KEY).toBe("ghl-live-api-key-AAA");
    expect(secretPresenceFromBlob(blob).GHL_API_KEY).toBe("SET");
    expect(JSON.stringify(logs)).not.toContain("ghl-live-api-key-AAA");
    log.mockRestore();
    info.mockRestore();
  });
});
