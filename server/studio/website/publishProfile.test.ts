import { describe, expect, it } from "vitest";
import { getAstroSiteRuntimeSecrets } from "../../../shared/astroSiteContract";
import {
  WEBSITE_REQUIRED_PROFILE_KEYS,
  emptySecretPresence,
} from "../../../shared/clientIntegrationProfile";
import {
  buildReadyPaidFunnelProfileDto,
  buildReadyPaidFunnelSecrets,
  memoryProfileResolver,
} from "../paidFunnel/profileMapping";
import {
  assertAstroSitePublishProfileReady,
  planAstroSitePublishFromProfile,
} from "./publishProfile";

const REQUIRED_RUNTIME = getAstroSiteRuntimeSecrets({ ghl: true, meta: true });

function readyResolver(clientId = 5) {
  const dto = buildReadyPaidFunnelProfileDto(clientId);
  const secrets = buildReadyPaidFunnelSecrets();
  return {
    dto,
    secrets,
    resolver: memoryProfileResolver([{ clientId, dto, secrets }]),
  };
}

describe("website publish ClientIntegrationProfile planner", () => {
  it("reuses the shared profile by clientId for website runtime secrets", () => {
    const { dto, secrets, resolver } = readyResolver(5);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    });
    expect(planned).toEqual({
      ok: true,
      clientId: 5,
      runtimeSecrets: {
        ADMIN_PASSWORD: secrets.ADMIN_PASSWORD,
        ADMIN_SESSION_SECRET: secrets.ADMIN_SESSION_SECRET,
        GHL_API_KEY: secrets.GHL_API_KEY,
        GHL_LOCATION_ID: dto.identifiers.GHL_LOCATION_ID,
        META_PIXEL_ID: dto.identifiers.META_PIXEL_ID,
        META_CAPI_ACCESS_TOKEN: secrets.META_CAPI_ACCESS_TOKEN,
        STAGE_WEBHOOK_SECRET: secrets.STAGE_WEBHOOK_SECRET,
      },
    });
    expect(WEBSITE_REQUIRED_PROFILE_KEYS.length).toBeGreaterThan(REQUIRED_RUNTIME.length);
    expect(assertAstroSitePublishProfileReady({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    }).clientId).toBe(5);
  });

  it("fails closed when the profile is missing for that clientId", () => {
    const { resolver } = readyResolver(5);
    const planned = planAstroSitePublishFromProfile({
      clientId: 22,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    });
    expect(planned).toEqual({
      ok: false,
      clientId: 22,
      runtimeSecrets: null,
      error: "Client integration profile is not SET.",
    });
    expect(() =>
      assertAstroSitePublishProfileReady({
        clientId: 22,
        resolver,
        requiredSecretNames: REQUIRED_RUNTIME,
      }),
    ).toThrow(/not SET/);
  });

  it("fails closed on clientId mismatch", () => {
    const dto = buildReadyPaidFunnelProfileDto(5);
    const secrets = buildReadyPaidFunnelSecrets();
    const resolver = memoryProfileResolver([
      { clientId: 5, dto: { ...dto, clientId: 99 }, secrets },
    ]);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    });
    expect(planned.ok).toBe(false);
    expect(planned.runtimeSecrets).toBeNull();
    expect(planned.ok ? "" : planned.error).toBe(
      "Client integration profile clientId mismatch.",
    );
  });

  it("fails closed when required website keys are NOT SET", () => {
    const dto = buildReadyPaidFunnelProfileDto(5);
    dto.secretPresence.ADMIN_PASSWORD = "NOT SET";
    const secrets = buildReadyPaidFunnelSecrets();
    delete secrets.ADMIN_PASSWORD;
    const resolver = memoryProfileResolver([{ clientId: 5, dto, secrets }]);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    });
    expect(planned.ok).toBe(false);
    expect(planned.runtimeSecrets).toBeNull();
    expect(planned.ok ? "" : planned.error).toContain("NOT SET");
    expect(planned.ok ? "" : planned.error).toContain("ADMIN_PASSWORD");
    expect(JSON.stringify(planned)).not.toContain("admin-password-XYZ");
  });

  it("fails closed on reconciliation conflict", () => {
    const dto = buildReadyPaidFunnelProfileDto(5);
    const conflicted = {
      ...dto,
      reconciliationStatus: "conflict" as const,
      conflictedKeys: ["GHL_API_KEY"],
      readiness: {
        ...dto.readiness,
        websiteReady: false,
      },
    };
    const resolver = memoryProfileResolver([
      { clientId: 5, dto: conflicted, secrets: buildReadyPaidFunnelSecrets() },
    ]);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
    });
    expect(planned).toEqual({
      ok: false,
      clientId: 5,
      runtimeSecrets: null,
      error: "Client integration profile has a reconciliation conflict.",
    });
    expect(JSON.stringify(planned)).not.toContain("ghl-live-api-key-AAA");
  });

  it("fails closed when legacy wrangler values conflict with the profile", () => {
    const { dto, secrets, resolver } = readyResolver(5);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
      legacyValues: [
        {
          identifiers: { GHL_LOCATION_ID: dto.identifiers.GHL_LOCATION_ID ?? undefined },
          secrets: { GHL_API_KEY: "ghl-from-wrangler-DIFFERENT" },
        },
      ],
    });
    expect(planned.ok).toBe(false);
    expect(planned.runtimeSecrets).toBeNull();
    expect(planned.ok ? "" : planned.error).toContain("conflicts with legacy");
    expect(planned.ok ? "" : planned.error).toContain("GHL_API_KEY");
    expect(JSON.stringify(planned)).not.toContain("ghl-from-wrangler-DIFFERENT");
    expect(JSON.stringify(planned)).not.toContain(secrets.GHL_API_KEY);
  });

  it("does not silently prefer matching legacy values over the profile", () => {
    const { dto, secrets, resolver } = readyResolver(5);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
      legacyValues: [
        {
          identifiers: {
            GHL_LOCATION_ID: dto.identifiers.GHL_LOCATION_ID ?? undefined,
            META_PIXEL_ID: dto.identifiers.META_PIXEL_ID ?? undefined,
          },
          secrets: {
            GHL_API_KEY: secrets.GHL_API_KEY,
            META_CAPI_ACCESS_TOKEN: secrets.META_CAPI_ACCESS_TOKEN,
          },
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.runtimeSecrets.GHL_API_KEY).toBe(secrets.GHL_API_KEY);
    expect(planned.runtimeSecrets.ADMIN_PASSWORD).toBe(secrets.ADMIN_PASSWORD);
  });

  it("does not invent secrets from an empty profile", () => {
    const dto = buildReadyPaidFunnelProfileDto(5);
    dto.secretPresence = emptySecretPresence();
    dto.identifiers.GHL_LOCATION_ID = null;
    dto.identifiers.GOOGLE_SHEETS_ID = null;
    dto.identifiers.META_PIXEL_ID = null;
    const resolver = memoryProfileResolver([{ clientId: 5, dto, secrets: {} }]);
    const planned = planAstroSitePublishFromProfile({
      clientId: 5,
      resolver,
      requiredSecretNames: REQUIRED_RUNTIME,
      legacyValues: [
        {
          identifiers: {},
          secrets: { ADMIN_PASSWORD: "legacy-only-admin-password" },
        },
      ],
    });
    expect(planned.ok).toBe(false);
    expect(planned.runtimeSecrets).toBeNull();
    expect(planned.ok ? "" : planned.error).toContain("NOT SET");
    expect(JSON.stringify(planned)).not.toContain("legacy-only-admin-password");
  });
});
