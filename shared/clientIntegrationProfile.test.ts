import { describe, expect, it } from "vitest";
import { WRANGLER_SECRET_VALUES } from "./astroConfig";
import {
  SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS,
  SIMPLE_FORM_CLIENT_SECRET_KEYS,
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  SIMPLE_FORM_RUNTIME_SECRET_KEYS,
} from "./simpleFormContract";
import {
  CLIENT_INTEGRATION_IDENTIFIER_KEYS,
  CLIENT_INTEGRATION_PROFILE_KEYS,
  CLIENT_INTEGRATION_SECRET_KEYS,
  CLIENT_INTEGRATION_SHARED_SECRET_KEYS,
  CLIENT_INTEGRATION_UI_GROUPS,
  CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS,
  FORBIDDEN_PROFILE_KEYS,
  FUNNEL_REQUIRED_PROFILE_KEYS,
  LEGACY_SECRET_KEY_ALIASES,
  WEBSITE_REQUIRED_PROFILE_KEYS,
  assertDtoOmitsSecretValues,
  buildClientIntegrationProfileDto,
  canonicalizeLegacyKey,
  clientIntegrationFieldError,
  cloneProfileReference,
  computeClientIntegrationReadiness,
  emptyIdentifiers,
  emptySecretPresence,
} from "./clientIntegrationProfile";

describe("ClientIntegrationProfile contract", () => {
  it("derives canonical keys from Simple Form and Wrangler contracts", () => {
    expect([...CLIENT_INTEGRATION_IDENTIFIER_KEYS]).toEqual([
      ...SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS,
    ]);
    expect(CLIENT_INTEGRATION_SHARED_SECRET_KEYS).toEqual(
      expect.arrayContaining([...SIMPLE_FORM_CLIENT_SECRET_KEYS]),
    );
    expect(CLIENT_INTEGRATION_PROFILE_KEYS).toEqual(
      expect.arrayContaining([...SIMPLE_FORM_RUNTIME_SECRET_KEYS]),
    );
    expect([...CLIENT_INTEGRATION_PROFILE_KEYS].sort()).toEqual(
      [...WRANGLER_SECRET_VALUES].sort(),
    );
    expect(FUNNEL_REQUIRED_PROFILE_KEYS).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets,
    );
    expect(WEBSITE_REQUIRED_PROFILE_KEYS).toEqual(
      expect.arrayContaining([...CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS]),
    );
  });

  it("does not invent GHL_WEBHOOK_URL or CRM_CALLBACK_SECRET as profile keys", () => {
    expect(CLIENT_INTEGRATION_PROFILE_KEYS).not.toEqual(
      expect.arrayContaining([...FORBIDDEN_PROFILE_KEYS]),
    );
    expect(LEGACY_SECRET_KEY_ALIASES.GHL_WEBHOOK_URL).toBe("GHL_API_KEY");
    expect(LEGACY_SECRET_KEY_ALIASES.CRM_CALLBACK_SECRET).toBe("STAGE_WEBHOOK_SECRET");
    expect(canonicalizeLegacyKey("GHL_WEBHOOK_URL")).toBe("GHL_API_KEY");
    expect(canonicalizeLegacyKey("CRM_CALLBACK_SECRET")).toBe("STAGE_WEBHOOK_SECRET");
  });

  it("rejects malformed customer settings before they can block a live funnel", () => {
    expect(clientIntegrationFieldError("META_PIXEL_ID", "pixel-123")).toMatch(/digits/);
    expect(clientIntegrationFieldError("GOOGLE_SHEETS_ID", "https://docs.google.com/sheets/d/abc")).toMatch(/ID format/);
    expect(clientIntegrationFieldError("GOOGLE_SERVICE_ACCOUNT_EMAIL", "person@example.com")).toMatch(/service-account/);
    expect(clientIntegrationFieldError("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "not-a-key")).toMatch(/PEM/);
    expect(clientIntegrationFieldError("ALERT_WEBHOOK_URL", "http://example.com/hook")).toMatch(/HTTPS/);
    expect(clientIntegrationFieldError("META_PIXEL_ID", "123456789012345")).toBeNull();
    expect(clientIntegrationFieldError("GOOGLE_SERVICE_ACCOUNT_EMAIL", "launch@project.iam.gserviceaccount.com")).toBeNull();
    expect(clientIntegrationFieldError("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toBeNull();
  });

  it("omits secret values from DTOs and only reports SET / NOT SET", () => {
    const secretValues = [
      "ghl-live-api-key-AAA",
      "meta-capi-token-BBB",
      "stage-webhook-secret-CCC",
      "sa@example.com",
      "-----BEGIN PRIVATE KEY-----secret",
    ];
    const presence = emptySecretPresence();
    presence.GHL_API_KEY = "SET";
    presence.META_CAPI_ACCESS_TOKEN = "SET";
    presence.STAGE_WEBHOOK_SECRET = "SET";
    const dto = buildClientIntegrationProfileDto({
      clientId: 9,
      identifiers: {
        GHL_LOCATION_ID: "loc_123",
        GOOGLE_SHEETS_ID: "sheet_123",
        META_PIXEL_ID: "123456789012345",
      },
      secretPresence: presence,
      lastUpdated: new Date("2026-08-18T06:00:00.000Z"),
      reconciliationStatus: "ready",
      conflictedKeys: [],
    });
    expect(dto.secretPresence.GHL_API_KEY).toBe("SET");
    expect(dto.secretPresence.ALERT_WEBHOOK_URL).toBe("NOT SET");
    expect(JSON.stringify(dto)).not.toMatch(/Encrypted/);
    expect(Object.keys(dto)).not.toEqual(
      expect.arrayContaining([...CLIENT_INTEGRATION_SECRET_KEYS]),
    );
    assertDtoOmitsSecretValues(dto, secretValues);
  });

  it("marks website and two funnels ready from one entered profile", () => {
    const identifiers = {
      GHL_LOCATION_ID: "loc_1",
      GOOGLE_SHEETS_ID: "sheet_1",
      META_PIXEL_ID: "123456789012345",
    };
    const secretPresence = emptySecretPresence();
    for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
      secretPresence[key] = "SET";
    }
    const website = computeClientIntegrationReadiness({ identifiers, secretPresence });
    const funnelA = computeClientIntegrationReadiness({ identifiers, secretPresence });
    const funnelB = computeClientIntegrationReadiness({ identifiers, secretPresence });
    expect(website.websiteReady).toBe(true);
    expect(funnelA.funnelReady).toBe(true);
    expect(funnelB.funnelReady).toBe(true);
  });

  it("updates shared readiness after rotation without copying secrets across clients", () => {
    const identifiers = emptyIdentifiers();
    identifiers.GHL_LOCATION_ID = "loc_1";
    identifiers.GOOGLE_SHEETS_ID = "sheet_1";
    identifiers.META_PIXEL_ID = "123456789012345";
    const before = emptySecretPresence();
    for (const key of CLIENT_INTEGRATION_SECRET_KEYS) before[key] = "SET";
    const after = { ...before, META_CAPI_ACCESS_TOKEN: "SET" as const };
    const rotated = computeClientIntegrationReadiness({
      identifiers,
      secretPresence: after,
    });
    expect(rotated.websiteReady).toBe(true);
    expect(rotated.funnelReady).toBe(true);
    const sameCustomer = cloneProfileReference({
      sourceClientId: 5,
      targetClientId: 5,
      sameCustomer: true,
    });
    const crossCustomer = cloneProfileReference({
      sourceClientId: 5,
      targetClientId: 22,
      sameCustomer: false,
    });
    expect(sameCustomer.clientId).toBe(5);
    expect(sameCustomer.copiesSecrets).toBe(false);
    expect(crossCustomer.clientId).toBe(22);
    expect(crossCustomer.copiesSecrets).toBe(false);
    const emptyClone = computeClientIntegrationReadiness({
      identifiers: emptyIdentifiers(),
      secretPresence: emptySecretPresence(),
    });
    expect(emptyClone.websiteReady).toBe(false);
    expect(emptyClone.funnelReady).toBe(false);
  });

  it("exposes UI groups without leftover identifier or secret keys", () => {
    const grouped = CLIENT_INTEGRATION_UI_GROUPS.flatMap(group => [...group.keys]);
    expect(grouped.sort()).toEqual([...CLIENT_INTEGRATION_PROFILE_KEYS].sort());
  });

  it("keeps META_VALUE_* out of active profile, UI, DTO, and required secrets", () => {
    const removed = [
      "META_VALUE_QUALIFIED",
      "META_VALUE_SCHEDULE",
      "META_VALUE_SHOWED",
    ];
    expect(WRANGLER_SECRET_VALUES).not.toEqual(expect.arrayContaining(removed));
    expect(CLIENT_INTEGRATION_PROFILE_KEYS).not.toEqual(expect.arrayContaining(removed));
    expect(CLIENT_INTEGRATION_SECRET_KEYS).not.toEqual(expect.arrayContaining(removed));
    expect(WEBSITE_REQUIRED_PROFILE_KEYS).not.toEqual(expect.arrayContaining(removed));
    expect(FUNNEL_REQUIRED_PROFILE_KEYS).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets,
    );
    expect(FUNNEL_REQUIRED_PROFILE_KEYS).toHaveLength(8);
    expect(FUNNEL_REQUIRED_PROFILE_KEYS).not.toEqual(expect.arrayContaining(removed));
    const grouped = CLIENT_INTEGRATION_UI_GROUPS.flatMap(group => [...group.keys]);
    expect(grouped).not.toEqual(expect.arrayContaining(removed));
    const dto = buildClientIntegrationProfileDto({
      clientId: 3,
      identifiers: emptyIdentifiers(),
      secretPresence: emptySecretPresence(),
      lastUpdated: null,
      reconciliationStatus: "pending",
      conflictedKeys: [],
    });
    expect(JSON.stringify(dto)).not.toMatch(/META_VALUE_/);
    expect(Object.keys(dto.secretPresence)).not.toEqual(expect.arrayContaining(removed));
    assertDtoOmitsSecretValues(dto, ["legacy-qualified-value-unused"]);
  });
});
