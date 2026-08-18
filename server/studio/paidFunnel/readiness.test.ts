import { describe, expect, it } from "vitest";
import {
  buildGenericPaidFunnelPackageFixture,
  buildGenericPaidFunnelSettingsFixture,
} from "../../../shared/studio/paidFunnelPackage";
import { buildReadyPaidFunnelProfileDto } from "./profileMapping";
import {
  PAID_FUNNEL_READINESS_KEYS,
  buildPaidFunnelReadiness,
} from "./readiness";

function sectionMissing(
  readiness: ReturnType<typeof buildPaidFunnelReadiness>,
  key: string
): string[] {
  return readiness.sections.find(section => section.key === key)?.missing ?? [];
}

describe("paid-funnel readiness", () => {
  it("is ready for the generic QA fixture against one client profile", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
    const readiness = buildPaidFunnelReadiness(pkg, settings, profile);
    expect(readiness.sections.map(section => section.key)).toEqual([
      ...PAID_FUNNEL_READINESS_KEYS,
    ]);
    expect(readiness.configurationReady).toBe(true);
    expect(readiness.sections.every(section => section.ready)).toBe(true);
  });

  it("fail-closes every check when the package is invalid", () => {
    const readiness = buildPaidFunnelReadiness(
      { kind: "website" },
      buildGenericPaidFunnelSettingsFixture(),
      buildReadyPaidFunnelProfileDto()
    );
    expect(readiness.configurationReady).toBe(false);
    expect(
      readiness.sections.every(section => section.ready === false)
    ).toBe(true);
  });

  it("blocks when a step is missing preview or publish state", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.stepStates = settings.stepStates.map(state =>
      state.stepKey === "form"
        ? { ...state, previewReady: false, publishReady: false }
        : state
    );
    const readiness = buildPaidFunnelReadiness(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
    );
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "steps")).toEqual(
      expect.arrayContaining([
        "Preview ready for form",
        "Publish ready for form",
      ])
    );
  });

  it("blocks when form mapping drops leadUuid or required lead fields", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const form = pkg.steps.find(step => step.key === "form");
    if (!form?.formMapping) throw new Error("fixture form mapping missing");
    form.formMapping = {
      joinKey: "leadUuid",
      fieldBindings: [{ leadField: "firstName", formField: "first-name" }],
    };
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const readiness = buildPaidFunnelReadiness(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
    );
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "formMapping")).toEqual(
      expect.arrayContaining([
        "Form mapping for form is missing email",
        "Form mapping for form is missing phone",
        "Form mapping for form is missing consent",
      ])
    );
  });

  it("blocks dangling next-step and extra navigation targets", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const landing = pkg.steps.find(step => step.key === "landing");
    if (!landing) throw new Error("fixture landing missing");
    landing.nextStep = "missing-step";
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.navigationTargets = ["also-missing"];
    const readiness = buildPaidFunnelReadiness(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
    );
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "navigation")).toEqual(
      expect.arrayContaining([
        "Step landing targets missing missing-step",
        "Navigation target also-missing is missing",
      ])
    );
  });

  it("blocks missing GHL and Sheets identifiers on the client profile", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
    profile.identifiers.GHL_LOCATION_ID = "";
    profile.identifiers.GOOGLE_SHEETS_ID = null;
    const readiness = buildPaidFunnelReadiness(pkg, settings, profile);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "integration")).toEqual([
      "GHL Location ID",
      "Google Sheet ID",
    ]);
  });

  it("blocks tracking when UTM, click IDs, pixel, or CAPI presence is missing", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.tracking.preserveUtm = false;
    settings.tracking.preserveClickIds = false;
    const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
    profile.identifiers.META_PIXEL_ID = "";
    profile.secretPresence.META_CAPI_ACCESS_TOKEN = "NOT SET";
    const readiness = buildPaidFunnelReadiness(pkg, settings, profile);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "tracking")).toEqual([
      "UTM preservation",
      "Click-ID preservation",
      "Meta Pixel ID",
      "Meta CAPI presence",
    ]);
  });

  it("requires secret names from package plus profile subset, not per-funnel collection", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    expect(settings).not.toHaveProperty("secretPresence");
    const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
    profile.secretPresence.STAGE_WEBHOOK_SECRET = "NOT SET";
    const readiness = buildPaidFunnelReadiness(pkg, settings, profile);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "secrets")).toEqual([
      "STAGE_WEBHOOK_SECRET",
    ]);
    expect(JSON.stringify(readiness)).not.toMatch(/server-only|secret-value|ghl-live-api-key/i);
  });

  it("fail-closes when the client profile is missing or conflicted", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const missing = buildPaidFunnelReadiness(pkg, settings);
    expect(missing.configurationReady).toBe(false);
    expect(sectionMissing(missing, "secrets")).toEqual([
      "Client integration profile",
    ]);

    const conflicted = buildReadyPaidFunnelProfileDto(settings.clientId);
    conflicted.reconciliationStatus = "conflict";
    conflicted.conflictedKeys = ["GHL_API_KEY"];
    const readiness = buildPaidFunnelReadiness(pkg, settings, conflicted);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "secrets")).toEqual(
      expect.arrayContaining([
        "Integration profile conflict",
        "GHL_API_KEY",
      ])
    );
    expect(JSON.stringify(readiness)).not.toContain("ghl-live-api-key");
  });

  it("blocks a missing build command or output directory", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    pkg.build.command = "   ";
    pkg.build.outputDir = "";
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const readiness = buildPaidFunnelReadiness(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
    );
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "build")).toEqual([
      "Build command",
      "Build outputDir",
    ]);
  });

  it("blocks Simple Form and Sun Pool on the generic adapter path", () => {
    const pkg = buildGenericPaidFunnelPackageFixture({
      publishAdapter: "legacy-simple-form",
    });
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.clientKey = "sun-pool";
    const readiness = buildPaidFunnelReadiness(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
    );
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "adapter")).toEqual(
      expect.arrayContaining([
        "Use the specialized Simple Form adapter",
        "Sun Pool is forbidden",
      ])
    );
  });
});
