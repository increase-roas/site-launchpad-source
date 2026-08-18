import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FUNNEL_REQUIRED_PROFILE_KEYS,
  assertDtoOmitsSecretValues,
  emptyIdentifiers,
} from "../../../shared/clientIntegrationProfile";
import {
  buildGenericPaidFunnelPackageFixture,
  buildGenericPaidFunnelSettingsFixture,
} from "../../../shared/studio/paidFunnelPackage";
import { buildPaidFunnelReadiness } from "./readiness";
import {
  authorizePaidFunnelLiveRewrite,
  buildReadyPaidFunnelProfileDto,
  buildReadyPaidFunnelSecrets,
  clonePaidFunnelClientProfile,
  encryptSecretBlob,
  mapProfileToGenericPaidFunnelBindings,
  memoryProfileResolver,
  requiredPaidFunnelSecretNames,
  resolvePaidFunnelProfileByClientId,
  resolvePublisherMappings,
} from "./profileMapping";

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

describe("paid-funnel client profile mapping", () => {
  it("derives required names from package plus the funnel profile subset", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const names = requiredPaidFunnelSecretNames(pkg);
    expect(names).toEqual(
      expect.arrayContaining([...FUNNEL_REQUIRED_PROFILE_KEYS])
    );
    expect(names).toEqual(
      expect.arrayContaining([...pkg.requiredRuntimeSecrets])
    );
  });

  it("maps a resolved client profile into generic adapter env and secrets", () => {
    const logs: unknown[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args);
    });
    const info = vi.spyOn(console, "info").mockImplementation((...args) => {
      logs.push(args);
    });
    const secrets = buildReadyPaidFunnelSecrets();
    const blob = encryptSecretBlob(secrets);
    const mappings = resolvePublisherMappings(blob);
    const dto = buildReadyPaidFunnelProfileDto(5);
    const bindings = mapProfileToGenericPaidFunnelBindings({
      clientId: 5,
      identifiers: dto.identifiers,
      secrets: mappings,
      requiredNames: requiredPaidFunnelSecretNames(
        buildGenericPaidFunnelPackageFixture()
      ),
    });
    expect(bindings.env.GHL_LOCATION_ID).toBe("location-123");
    expect(bindings.env.GOOGLE_SHEETS_ID).toBe("sheet-123");
    expect(bindings.env.META_PIXEL_ID).toBe("123456789012345");
    expect(bindings.secrets.GHL_API_KEY).toBe("ghl-live-api-key-AAA");
    expect(bindings.secrets.META_CAPI_ACCESS_TOKEN).toBe("meta-capi-token-BBB");
    expect(bindings.bindingNames).toEqual(
      expect.arrayContaining(["GHL_API_KEY", "GHL_LOCATION_ID"])
    );
    expect(JSON.stringify(logs)).not.toContain("ghl-live-api-key-AAA");
    expect(JSON.stringify(logs)).not.toContain("meta-capi-token-BBB");
    assertDtoOmitsSecretValues(dto, Object.values(secrets));
    log.mockRestore();
    info.mockRestore();
  });

  it("resolves the profile by clientId and fails closed when it is missing", () => {
    const secrets = buildReadyPaidFunnelSecrets();
    const dto = buildReadyPaidFunnelProfileDto(5);
    const resolver = memoryProfileResolver([
      { clientId: 5, dto, secrets },
    ]);
    const found = resolvePaidFunnelProfileByClientId(5, resolver);
    expect(found.ok).toBe(true);
    const missing = resolvePaidFunnelProfileByClientId(22, resolver);
    expect(missing).toEqual({
      ok: false,
      error: "Client integration profile is not SET.",
    });
  });

  it("keeps the profile ref on same-client clone and never copies secrets across clients", () => {
    const source = buildReadyPaidFunnelProfileDto(5);
    const same = clonePaidFunnelClientProfile({
      sourceClientId: 5,
      targetClientId: 5,
      sameCustomer: true,
      sourceProfile: source,
    });
    const cross = clonePaidFunnelClientProfile({
      sourceClientId: 5,
      targetClientId: 22,
      sameCustomer: false,
      sourceProfile: source,
    });
    expect(same.clientId).toBe(5);
    expect(same.copiesSecrets).toBe(false);
    expect(same.profile).toBe(source);
    expect(same.profile.secretPresence.GHL_API_KEY).toBe("SET");

    expect(cross.clientId).toBe(22);
    expect(cross.copiesSecrets).toBe(false);
    expect(cross.profile.identifiers).toEqual(emptyIdentifiers());
    expect(cross.profile.secretPresence.GHL_API_KEY).toBe("NOT SET");
    expect(JSON.stringify(cross.profile)).not.toContain("ghl-live-api-key-AAA");

    const pkg = buildGenericPaidFunnelPackageFixture();
    const destSettings = buildGenericPaidFunnelSettingsFixture(pkg, 22);
    const destReadiness = buildPaidFunnelReadiness(
      pkg,
      destSettings,
      cross.profile
    );
    expect(destReadiness.configurationReady).toBe(false);
    expect(
      destReadiness.sections.find(section => section.key === "secrets")
        ?.missing
    ).toEqual(expect.arrayContaining(["GHL_API_KEY", "STAGE_WEBHOOK_SECRET"]));

    const sameReadiness = buildPaidFunnelReadiness(
      pkg,
      buildGenericPaidFunnelSettingsFixture(pkg, 5),
      same.profile
    );
    expect(sameReadiness.configurationReady).toBe(true);
  });

  it("requires explicit Republish or Sync Integrations for live deploys", () => {
    expect(
      authorizePaidFunnelLiveRewrite({ hasLiveDeploy: false })
    ).toEqual({ ok: true, action: "publish" });
    expect(
      authorizePaidFunnelLiveRewrite({
        hasLiveDeploy: true,
        action: "publish",
      }).ok
    ).toBe(false);
    expect(
      authorizePaidFunnelLiveRewrite({
        hasLiveDeploy: true,
        action: "republish",
      })
    ).toEqual({ ok: true, action: "republish" });
    expect(
      authorizePaidFunnelLiveRewrite({
        hasLiveDeploy: true,
        action: "sync-integrations",
      })
    ).toEqual({ ok: true, action: "sync-integrations" });
  });
});
