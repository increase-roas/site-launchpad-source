import { describe, expect, it } from "vitest";
import {
  createAstroHomepageSection,
  summarizeHomepageSections,
} from "@shared/astroConfig";
import type { OperationalSummary } from "@shared/operationalSummary";
import { buildLaunchChecks, launchBlockers, launchReadiness } from "./launchChecks";

function summary(overrides: Partial<OperationalSummary> = {}): OperationalSummary {
  return {
    status: "setup_needed",
    statusLabel: "Setup needed",
    liveUrl: null,
    items: [
      { key: "businessInformation", label: "Business information", complete: true },
      { key: "websiteSetup", label: "Website setup", complete: false },
    ],
    runtimeConfiguration: {
      set: 4,
      total: 4,
      label: "Runtime configuration",
      requiredMissing: [],
      optionalUnset: [],
      blocksLaunch: false,
    },
    ...overrides,
  };
}

describe("pre-launch checks", () => {
  it("turns every readiness item into a check that links at its fix", () => {
    const checks = buildLaunchChecks({ clientId: 5, summary: summary() });

    expect(checks.find(check => check.key === "businessInformation")).toMatchObject({
      state: "pass",
      fixHref: "/workspace/5/configuration?tab=basic",
    });
    expect(checks.find(check => check.key === "websiteSetup")).toMatchObject({
      state: "fail",
      fixHref: "/workspace/5/configuration?tab=media",
    });
  });

  it("names the publish-profile gaps that keep deployMode off client", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [{ key: "businessInformation", label: "Business", complete: true }],
      }),
      homepageSections: { enabled: 1, total: 2 },
      clientDeploy: {
        gaps: ["Map coordinates", "At least one product category"],
      },
    });
    const deploy = checks.find(check => check.key === "clientDeploy");

    expect(deploy).toMatchObject({
      state: "fail",
      detail: "Map coordinates; At least one product category",
      fixHref: "/workspace/5/configuration?tab=basic",
    });
  });

  it("sends a category-only publish gap to the Content tab", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [{ key: "businessInformation", label: "Business", complete: true }],
      }),
      homepageSections: { enabled: 1, total: 2 },
      clientDeploy: { gaps: ["At least one product category"] },
    });

    expect(checks.find(check => check.key === "clientDeploy")?.fixHref).toBe(
      "/workspace/5/configuration?tab=content",
    );
  });

  it("names the missing secrets and sends them to Integrations", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        runtimeConfiguration: {
          set: 3,
          total: 4,
          label: "Runtime configuration",
          requiredMissing: ["META_ACCESS_TOKEN"],
          optionalUnset: [],
          blocksLaunch: true,
        },
      }),
    });
    const secrets = checks.find(check => check.key === "runtimeSecrets");

    expect(secrets?.state).toBe("fail");
    expect(secrets?.detail).toContain("META_ACCESS_TOKEN");
    expect(secrets?.fixHref).toBe("/workspace/5/integrations");
  });

  it("does not treat an unpublished website as a reason to block Publish", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [
          { key: "businessInformation", label: "Business", complete: true },
          { key: "websiteSetup", label: "Website setup", complete: true },
          { key: "websiteIntegrations", label: "Website integrations", complete: true },
          { key: "websiteLive", label: "Website live", complete: false },
        ],
      }),
      homepageSections: { enabled: 1, total: 2 },
      clientDeploy: { gaps: [] },
    });

    expect(checks.map(check => check.key)).not.toContain("websiteLive");
    expect(launchReadiness(checks).ready).toBe(true);
  });

  it("raises no check for campaign readiness while campaigns are deferred", () => {
    // Otherwise a website could never publish: the campaign items can only be
    // completed from a screen operators cannot reach in this phase.
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [
          { key: "businessInformation", label: "Business", complete: true },
          { key: "funnelIntegrations", label: "Funnel integrations", complete: false },
          { key: "funnelsLive", label: "Funnels live", complete: false },
        ],
      }),
      homepageSections: { enabled: 6, total: 8 },
      clientDeploy: { gaps: [] },
    });

    expect(checks.map(check => check.key)).not.toContain("funnelIntegrations");
    expect(checks.map(check => check.key)).not.toContain("funnelsLive");
    expect(launchReadiness(checks).ready).toBe(true);
  });

  it("holds the homepage check as pending until the configuration arrives", () => {
    const loading = buildLaunchChecks({
      clientId: 5,
      summary: summary(),
      clientDeploy: { gaps: [] },
    });
    expect(loading.find(check => check.key === "homepageSections")?.state).toBe(
      "pending",
    );

    const loaded = buildLaunchChecks({
      clientId: 5,
      summary: summary(),
      homepageSections: { enabled: 0, total: 8 },
    });
    expect(loaded.find(check => check.key === "homepageSections")?.state).toBe("fail");
  });

  it("derives the homepage check from the sections that publish", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary(),
      homepageSections: summarizeHomepageSections([
        { ...createAstroHomepageSection("hero", "section-hero"), enabled: true },
        createAstroHomepageSection("faq", "section-faq"),
      ]),
    });
    const homepage = checks.find(check => check.key === "homepageSections");

    expect(homepage?.state).toBe("pass");
    expect(homepage?.detail).toBe("1 of 2 sections visible");
  });

  it("sends the homepage blocker to the tab that owns section content", () => {
    const checks = buildLaunchChecks({
      clientId: 5,
      summary: summary(),
      homepageSections: { enabled: 0, total: 6 },
    });

    expect(checks.find(check => check.key === "homepageSections")?.fixHref).toBe(
      "/workspace/5/configuration?tab=content",
    );
  });
});

describe("launch readiness", () => {
  it("is ready only when every check has reported a pass", () => {
    const allPassing = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [{ key: "businessInformation", label: "Business", complete: true }],
      }),
      homepageSections: { enabled: 6, total: 8 },
      clientDeploy: { gaps: [] },
    });

    expect(launchReadiness(allPassing)).toMatchObject({ ready: true, failing: 0 });
  });

  it("is not ready while a check is still pending", () => {
    const pending = buildLaunchChecks({
      clientId: 5,
      summary: summary({
        items: [{ key: "businessInformation", label: "Business", complete: true }],
      }),
      clientDeploy: { gaps: [] },
    });

    expect(launchReadiness(pending)).toMatchObject({ ready: false, pending: 1 });
  });

  it("counts the outstanding checks so the page can name them", () => {
    const readiness = launchReadiness(
      buildLaunchChecks({
        clientId: 5,
        summary: summary(),
        homepageSections: { enabled: 3, total: 8 },
        clientDeploy: { gaps: [] },
      }),
    );

    expect(readiness).toMatchObject({ passed: 4, failing: 1, total: 5 });
  });
});

describe("launch blockers", () => {
  it("lifts out only the failing checks, so passing ones stay out of the way", () => {
    const blockers = launchBlockers(
      buildLaunchChecks({
        clientId: 5,
        summary: summary(),
        homepageSections: { enabled: 3, total: 8 },
        clientDeploy: { gaps: [] },
      }),
    );

    expect(blockers.map(check => check.key)).toEqual(["websiteSetup"]);
  });

  it("leaves nothing to fix when every check passes", () => {
    const blockers = launchBlockers(
      buildLaunchChecks({
        clientId: 5,
        summary: summary({
          items: [{ key: "businessInformation", label: "Business", complete: true }],
        }),
        homepageSections: { enabled: 6, total: 8 },
        clientDeploy: { gaps: [] },
      }),
    );

    expect(blockers).toEqual([]);
  });

  it("does not treat a still-loading check as a blocker", () => {
    const blockers = launchBlockers(
      buildLaunchChecks({
        clientId: 5,
        summary: summary({
          items: [{ key: "businessInformation", label: "Business", complete: true }],
        }),
        clientDeploy: { gaps: [] },
      }),
    );

    expect(blockers).toEqual([]);
  });
});
