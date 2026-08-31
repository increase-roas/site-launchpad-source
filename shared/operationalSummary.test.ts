import { describe, expect, it } from "vitest";
import {
  WRANGLER_SECRET_VALUES,
  createDefaultAstroConfig,
  emptyWranglerSecretStatus,
} from "./astroConfig";
import { REQUIRED_ASSET_SLOTS } from "./astroConfigReadiness";
import { ASSET_SLOT_VALUES } from "./client";
import { validClientInput } from "./client.test";
import {
  buildOperationalSummary,
  integrationPresenceTone,
  isCompletedPublishJob,
  summarizeRuntimeConfiguration,
} from "./operationalSummary";

const allSecretsSet = Object.fromEntries(
  WRANGLER_SECRET_VALUES.map(name => [name, true])
) as Record<(typeof WRANGLER_SECRET_VALUES)[number], boolean>;

describe("operational launch summary", () => {
  it("replaces the 14-item percent bar with six operational checks", () => {
    const summary = buildOperationalSummary({
      client: validClientInput,
      presentAssetSlots: ASSET_SLOT_VALUES,
      websiteIntegrationsReady: true,
      funnelIntegrationsReady: true,
      websitePublish: { status: "published", liveUrl: "https://northland.example.workers.dev" },
      funnelPublishes: [{ status: "published", liveUrl: "https://funnel.example.workers.dev" }],
      secretStatus: allSecretsSet,
    });

    expect(summary.items.map(item => item.label)).toEqual([
      "Business information",
      "Website setup",
      "Website integrations",
      "Website live",
      "Funnel integrations",
      "Funnels live",
    ]);
    expect(summary.items.every(item => item.complete)).toBe(true);
    expect(summary.statusLabel).toBe("Live");
    expect(summary.liveUrl).toBe("https://northland.example.workers.dev");
  });

  it("keeps photos inside website setup and does not list them on the board", () => {
    const summary = buildOperationalSummary({
      client: validClientInput,
      presentAssetSlots: ["logo"],
      websiteIntegrationsReady: true,
      funnelIntegrationsReady: false,
      websitePublish: null,
      funnelPublishes: [],
    });
    expect(summary.items.find(item => item.key === "websiteSetup")?.complete).toBe(false);
    expect(summary.items.some(item => item.label.toLowerCase().includes("photo"))).toBe(false);
    expect(summary.statusLabel).toBe("Setup needed");
  });

  it("does not let missing GA4 or Clarity block ready-to-publish", () => {
    const summary = buildOperationalSummary({
      client: validClientInput,
      presentAssetSlots: ASSET_SLOT_VALUES,
      websiteIntegrationsReady: true,
      funnelIntegrationsReady: false,
      websitePublish: null,
      funnelPublishes: [],
      secretStatus: {
        ...emptyWranglerSecretStatus(),
        ...Object.fromEntries(
          WRANGLER_SECRET_VALUES.filter(name => name !== "ALERT_WEBHOOK_URL").map(name => [
            name,
            true,
          ])
        ),
      },
    });
    expect(summary.statusLabel).toBe("Ready to publish");
    expect(summary.runtimeConfiguration.blocksLaunch).toBe(false);
  });

  it("treats a completed publish job with a live URL as published", () => {
    expect(
      isCompletedPublishJob({ status: "published", liveUrl: "https://live.example" })
    ).toBe(true);
    expect(isCompletedPublishJob({ status: "published", liveUrl: null })).toBe(false);
    expect(isCompletedPublishJob({ status: "running", liveUrl: "https://live.example" })).toBe(
      false
    );
  });

  it("surfaces Publishing and Issue from real publisher jobs", () => {
    const publishing = buildOperationalSummary({
      client: validClientInput,
      presentAssetSlots: ASSET_SLOT_VALUES,
      websiteIntegrationsReady: true,
      funnelIntegrationsReady: true,
      websitePublish: { status: "running", liveUrl: null },
      funnelPublishes: [],
    });
    expect(publishing.statusLabel).toBe("Publishing");

    const issue = buildOperationalSummary({
      client: validClientInput,
      presentAssetSlots: ASSET_SLOT_VALUES,
      websiteIntegrationsReady: true,
      funnelIntegrationsReady: true,
      websitePublish: { status: "failed", liveUrl: null },
      funnelPublishes: [],
    });
    expect(issue.statusLabel).toBe("Issue");
  });

  it("treats business information as the Astro Basic tab when a config is supplied", () => {
    const leftoverGaps = {
      ...validClientInput,
      googleMapsUrl: undefined,
      primaryOffer: undefined,
      financingPromise: undefined,
      deliveryPromise: undefined,
    };
    const astroConfig = createDefaultAstroConfig({
      businessName: leftoverGaps.businessName,
      shortName: leftoverGaps.shortName,
      foundedYear: leftoverGaps.foundedYear,
      tagline: leftoverGaps.tagline,
      websiteUrl: leftoverGaps.websiteUrl,
      phone: leftoverGaps.phone,
      email: leftoverGaps.email,
      streetAddress: leftoverGaps.streetAddress,
      city: leftoverGaps.city,
      state: leftoverGaps.state,
      postalCode: leftoverGaps.postalCode,
      country: leftoverGaps.country,
      businessHours: leftoverGaps.businessHours,
      facebookUrl: leftoverGaps.facebookUrl,
      theme: leftoverGaps.theme,
    });

    expect(
      buildOperationalSummary({
        client: leftoverGaps,
        presentAssetSlots: ASSET_SLOT_VALUES,
        websiteIntegrationsReady: true,
        funnelIntegrationsReady: true,
        websitePublish: null,
        funnelPublishes: [],
      }).items.find(item => item.key === "businessInformation")?.complete,
    ).toBe(false);

    expect(
      buildOperationalSummary({
        client: leftoverGaps,
        astroConfig,
        presentAssetSlots: ASSET_SLOT_VALUES,
        websiteIntegrationsReady: true,
        funnelIntegrationsReady: true,
        websitePublish: null,
        funnelPublishes: [],
      }).items.find(item => item.key === "businessInformation")?.complete,
    ).toBe(true);
  });

  it("treats website setup as Astro branding and media when a config is supplied", () => {
    const astroConfig = createDefaultAstroConfig({
      businessName: validClientInput.businessName,
      shortName: validClientInput.shortName,
      foundedYear: validClientInput.foundedYear,
      tagline: validClientInput.tagline,
      websiteUrl: validClientInput.websiteUrl,
      phone: validClientInput.phone,
      email: validClientInput.email,
      streetAddress: validClientInput.streetAddress,
      city: validClientInput.city,
      state: validClientInput.state,
      postalCode: validClientInput.postalCode,
      country: validClientInput.country,
      businessHours: validClientInput.businessHours,
      facebookUrl: validClientInput.facebookUrl,
      theme: validClientInput.theme,
    });

    expect(
      buildOperationalSummary({
        client: validClientInput,
        astroConfig,
        presentAssetSlots: ASSET_SLOT_VALUES,
        websiteIntegrationsReady: true,
        funnelIntegrationsReady: true,
        websitePublish: null,
        funnelPublishes: [],
      }).items.find(item => item.key === "websiteSetup")?.complete,
    ).toBe(false);

    expect(
      buildOperationalSummary({
        client: validClientInput,
        astroConfig,
        presentAssetSlots: REQUIRED_ASSET_SLOTS,
        websiteIntegrationsReady: true,
        funnelIntegrationsReady: true,
        websitePublish: null,
        funnelPublishes: [],
      }).items.find(item => item.key === "websiteSetup")?.complete,
    ).toBe(true);
  });
});

describe("runtime configuration counter", () => {
  it("labels the 11 wrangler values without treating optional alert as failure", () => {
    const status = emptyWranglerSecretStatus();
    for (const name of WRANGLER_SECRET_VALUES) {
      if (name !== "ALERT_WEBHOOK_URL") status[name] = true;
    }
    const summary = summarizeRuntimeConfiguration(status);
    expect(WRANGLER_SECRET_VALUES).toHaveLength(11);
    expect(summary).toMatchObject({
      set: 10,
      total: 11,
      label: "Runtime configuration — 10 of 11 set",
      optionalUnset: ["ALERT_WEBHOOK_URL"],
      blocksLaunch: false,
    });
    expect(integrationPresenceTone("ALERT_WEBHOOK_URL", "NOT SET")).toBe("optional");
    expect(integrationPresenceTone("GHL_API_KEY", "NOT SET")).toBe("missing");
  });

  it("does not hold launch open for integrations the client switched off", () => {
    const status = emptyWranglerSecretStatus();
    status.ADMIN_PASSWORD = true;
    status.ADMIN_SESSION_SECRET = true;
    const summary = summarizeRuntimeConfiguration(status, {});
    expect(summary.requiredMissing).toEqual([]);
    expect(summary.blocksLaunch).toBe(false);
  });

  it("holds launch open for the credentials of an integration that is switched on", () => {
    const status = emptyWranglerSecretStatus();
    status.ADMIN_PASSWORD = true;
    status.ADMIN_SESSION_SECRET = true;
    const summary = summarizeRuntimeConfiguration(status, { ghl: true });
    expect(summary.requiredMissing).toEqual(["GHL_API_KEY", "GHL_LOCATION_ID"]);
    expect(summary.blocksLaunch).toBe(true);
  });

  it("still counts the whole shared vault, which funnels draw from too", () => {
    const status = emptyWranglerSecretStatus();
    status.ADMIN_PASSWORD = true;
    status.ADMIN_SESSION_SECRET = true;
    expect(summarizeRuntimeConfiguration(status, {})).toMatchObject({
      set: 2,
      total: 11,
      label: "Runtime configuration — 2 of 11 set",
    });
  });
});
