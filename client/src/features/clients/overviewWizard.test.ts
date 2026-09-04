import { describe, expect, it } from "vitest";
import {
  createDefaultAstroConfig,
  emptyWranglerSecretStatus,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { REQUIRED_ASSET_SLOTS } from "@shared/astroConfigReadiness";
import { BUSINESS_DAY_VALUES } from "@shared/client";
import type { OperationalSummary } from "@shared/operationalSummary";
import { buildWizard } from "@/app/wizard";
import { buildOverviewWizardSignals } from "./overviewWizard";

const ALL_KEYS = [
  "businessInformation",
  "websiteSetup",
  "websiteIntegrations",
  "websiteLive",
  "funnelIntegrations",
  "funnelsLive",
] as const;

function operationalSummary(
  complete: Partial<Record<(typeof ALL_KEYS)[number], boolean>> = {},
): OperationalSummary {
  return {
    status: "setup_needed",
    statusLabel: "setup_needed",
    liveUrl: null,
    items: ALL_KEYS.map(key => ({
      key,
      label: key,
      complete: complete[key] ?? false,
    })),
    runtimeConfiguration: {
      set: 0,
      total: 4,
      label: "Runtime configuration",
      requiredMissing: [],
      optionalUnset: [],
      blocksLaunch: false,
    },
  };
}

function baseConfig(): AstroClientConfigInput {
  return createDefaultAstroConfig({
    businessName: "Fargo Hot Tubs",
    shortName: "Fargo Tubs",
    foundedYear: 2011,
    tagline: "Relax in Fargo",
    websiteUrl: "https://fargohottubs.com",
    phone: "+17015551234",
    email: "hello@fargohottubs.com",
    streetAddress: "1420 Dakota Ave",
    city: "Fargo",
    state: "ND",
    postalCode: "58103",
    country: "US",
    businessHours: BUSINESS_DAY_VALUES.map(day => ({
      day,
      isOpen: true,
      opensAt: "09:00",
      closesAt: "17:00",
    })),
    facebookUrl: "",
    theme: "aqua",
  });
}

const allAssets = REQUIRED_ASSET_SLOTS.map(slot => ({ slot }));

describe("overview wizard signals from the live configuration", () => {
  it("keeps pages open when a visible homepage section is missing copy", () => {
    const config = baseConfig();
    config.homepageSections[0]!.fields.headline = "";

    const signals = buildOverviewWizardSignals({
      operationalSummary: operationalSummary({
        businessInformation: true,
        websiteSetup: true,
        websiteIntegrations: true,
      }),
      config,
      assets: allAssets,
    });
    const pages = buildWizard(signals).find(step => step.step === "pages");

    expect(signals.pagesSetup?.complete).toBe(false);
    expect(pages?.state).not.toBe("complete");
    expect(pages?.blockedBy).toMatch(/homepage|content/i);
    expect(pages?.details?.some(detail => detail.state !== "complete")).toBe(true);
  });

  it("does not complete pages just because a homepage section is enabled", () => {
    const config = baseConfig();
    for (const section of config.homepageSections) section.enabled = true;
    config.homepageSections[0]!.fields.headline = "";

    const signals = buildOverviewWizardSignals({
      operationalSummary: operationalSummary(),
      config,
      assets: allAssets,
    });

    expect(signals.enabledSectionCount).toBeGreaterThan(0);
    expect(signals.pagesSetup?.complete).toBe(false);
  });

  it("keeps integrations open when required credentials are missing", () => {
    const signals = buildOverviewWizardSignals({
      operationalSummary: operationalSummary({ websiteIntegrations: true }),
      config: baseConfig(),
      assets: allAssets,
      secretStatus: emptyWranglerSecretStatus(),
    });
    const integrations = buildWizard(signals).find(
      step => step.step === "integrations",
    );

    expect(signals.integrationsSetup?.complete).toBe(false);
    expect(integrations?.state).not.toBe("complete");
    expect(integrations?.blockedBy).toBeTruthy();
  });

  it("does not guess integrations complete without credential status", () => {
    const signals = buildOverviewWizardSignals({
      operationalSummary: operationalSummary({ websiteIntegrations: true }),
      config: baseConfig(),
      assets: allAssets,
    });

    expect(signals.integrationsSetup).toBeUndefined();
  });

  it("carries per-section details from the configuration tabs", () => {
    const config = baseConfig();
    config.address.postalCode = "";

    const signals = buildOverviewWizardSignals({
      operationalSummary: operationalSummary(),
      config,
      assets: allAssets,
    });

    expect(signals.basicSetup?.complete).toBe(false);
    expect(signals.basicSetup?.details?.some(detail => detail.label === "Address")).toBe(
      true,
    );
    expect(signals.brandSetup?.details?.length).toBeGreaterThan(0);
    expect(signals.mediaSetup?.filled).toBe(REQUIRED_ASSET_SLOTS.length);
  });
});
