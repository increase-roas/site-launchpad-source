import { describe, expect, it } from "vitest";
import {
  buildGenericPaidFunnelPackageFixture,
  buildGenericPaidFunnelSettingsFixture,
} from "../../../shared/studio/paidFunnelPackage";
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
  it("is ready for the generic QA fixture", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const readiness = buildPaidFunnelReadiness(pkg, settings);
    expect(readiness.sections.map(section => section.key)).toEqual([
      ...PAID_FUNNEL_READINESS_KEYS,
    ]);
    expect(readiness.configurationReady).toBe(true);
    expect(readiness.sections.every(section => section.ready)).toBe(true);
  });

  it("fail-closes every check when the package is invalid", () => {
    const readiness = buildPaidFunnelReadiness(
      { kind: "website" },
      buildGenericPaidFunnelSettingsFixture()
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
    const readiness = buildPaidFunnelReadiness(pkg, settings);
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
    const readiness = buildPaidFunnelReadiness(
      pkg,
      buildGenericPaidFunnelSettingsFixture(pkg)
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
    const readiness = buildPaidFunnelReadiness(pkg, settings);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "navigation")).toEqual(
      expect.arrayContaining([
        "Step landing targets missing missing-step",
        "Navigation target also-missing is missing",
      ])
    );
  });

  it("blocks missing GHL and Sheets integration names", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.integrations.ghlLocationId = "";
    settings.integrations.googleSheetsId = null;
    const readiness = buildPaidFunnelReadiness(pkg, settings);
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
    settings.tracking.metaPixelId = "";
    settings.tracking.metaCapiPresent = false;
    const readiness = buildPaidFunnelReadiness(pkg, settings);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "tracking")).toEqual([
      "UTM preservation",
      "Click-ID preservation",
      "Meta Pixel ID",
      "Meta CAPI presence",
    ]);
  });

  it("blocks when a required runtime secret is not present", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.secretPresence.STAGE_WEBHOOK_SECRET = false;
    const readiness = buildPaidFunnelReadiness(pkg, settings);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "secrets")).toEqual([
      "STAGE_WEBHOOK_SECRET",
    ]);
    expect(JSON.stringify(readiness)).not.toMatch(/server-only|secret-value/i);
  });

  it("blocks a missing build command or output directory", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    pkg.build.command = "   ";
    pkg.build.outputDir = "";
    const readiness = buildPaidFunnelReadiness(
      pkg,
      buildGenericPaidFunnelSettingsFixture(pkg)
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
    const readiness = buildPaidFunnelReadiness(pkg, settings);
    expect(readiness.configurationReady).toBe(false);
    expect(sectionMissing(readiness, "adapter")).toEqual(
      expect.arrayContaining([
        "Use the specialized Simple Form adapter",
        "Sun Pool is forbidden",
      ])
    );
  });
});
