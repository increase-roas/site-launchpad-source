import { describe, expect, it } from "vitest";
import {
  createAstroHomepageSection,
  summarizeHomepageSections,
} from "@shared/astroConfig";
import type {
  OperationalStatus,
  OperationalSummary,
} from "@shared/operationalSummary";
import {
  buildWizard,
  wizardProgress,
  WIZARD_STEPS,
  WIZARD_STEP_DEFINITIONS,
  type WizardStep,
} from "./wizard";

const ALL_KEYS = [
  "businessInformation",
  "websiteSetup",
  "websiteIntegrations",
  "websiteLive",
  "funnelIntegrations",
  "funnelsLive",
] as const;

function summary(
  complete: Partial<Record<(typeof ALL_KEYS)[number], boolean>>,
  status: OperationalStatus = "setup_needed",
  requiredMissing: string[] = [],
): OperationalSummary {
  return {
    status,
    statusLabel: status,
    liveUrl: status === "live" ? "https://example.com" : null,
    items: ALL_KEYS.map(key => ({
      key,
      label: key,
      complete: complete[key] ?? false,
    })),
    runtimeConfiguration: {
      set: 4 - requiredMissing.length,
      total: 4,
      label: "Runtime configuration",
      requiredMissing,
      optionalUnset: [],
      blocksLaunch: requiredMissing.length > 0,
    },
  };
}

function stateOf(steps: ReturnType<typeof buildWizard>, step: WizardStep) {
  return steps.find(entry => entry.step === step)?.state;
}

describe("wizard shape", () => {
  it("returns the active steps in order, numbered without a gap", () => {
    const steps = buildWizard({ operationalSummary: summary({}) });
    expect(steps.map(step => step.step)).toEqual([
      "clientSetup",
      "brandContent",
      "mediaGallery",
      "pages",
      "integrations",
      "launch",
    ]);
    expect(steps.map(step => step.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("omits the campaigns step while campaigns are deferred", () => {
    const steps = buildWizard({ operationalSummary: summary({}) });
    expect(steps.map(step => step.step)).not.toContain("funnels");
    // The definition stays put, so re-enabling campaigns restores the step
    // rather than requiring it to be written again.
    expect(WIZARD_STEPS).toContain("funnels");
    expect(WIZARD_STEP_DEFINITIONS.funnels.label).toBe("Campaigns");
  });

  it("has no separate Preview QA step now that checks live on Launch", () => {
    const steps = buildWizard({ operationalSummary: summary({}) });
    expect(steps.map(step => step.step)).not.toContain("previewQa");
  });
});

describe("wizard step state from readiness", () => {
  it("marks completed readiness items complete", () => {
    const steps = buildWizard({
      operationalSummary: summary({
        businessInformation: true,
        websiteSetup: true,
      }),
    });

    expect(stateOf(steps, "clientSetup")).toBe("complete");
    expect(stateOf(steps, "brandContent")).toBe("complete");
    expect(stateOf(steps, "mediaGallery")).toBe("complete");
  });

  it("completes client setup from the Basic tab even when leftover client-row fields fail", () => {
    const steps = buildWizard({
      operationalSummary: summary({ businessInformation: false }),
      basicSetup: { complete: true },
    });
    expect(stateOf(steps, "clientSetup")).toBe("complete");
  });

  it("names the Basic tab section that is still open", () => {
    const steps = buildWizard({
      operationalSummary: summary({}),
      basicSetup: { complete: false, blockedBy: "Identity has invalid values" },
    });
    const setup = steps.find(step => step.step === "clientSetup");
    expect(setup?.state).toBe("current");
    expect(setup?.blockedBy).toBe("Identity has invalid values");
  });

  it("splits brand and media so one finished tab cannot mark the other complete", () => {
    const steps = buildWizard({
      operationalSummary: summary({ websiteSetup: true }),
      brandSetup: { complete: true },
      mediaSetup: { complete: false, blockedBy: "Media is incomplete" },
    });
    expect(stateOf(steps, "brandContent")).toBe("complete");
    expect(stateOf(steps, "mediaGallery")).toBe("todo");
    expect(steps.find(step => step.step === "mediaGallery")?.blockedBy).toBe(
      "Media is incomplete",
    );
  });

  it("completes the integrations step on website integrations alone while campaigns are deferred", () => {
    const steps = buildWizard({
      operationalSummary: summary({ websiteIntegrations: true }),
    });

    expect(stateOf(steps, "integrations")).toBe("complete");
  });

  it("completes the launch step from the website publish", () => {
    const websiteOnly = buildWizard({
      operationalSummary: summary({ websiteLive: true }, "live"),
    });
    expect(stateOf(websiteOnly, "launch")).toBe("complete");
  });

  it("does not accept a published campaign as the website being live", () => {
    const funnelOnly = buildWizard({
      operationalSummary: summary({ funnelsLive: true }),
    });

    expect(stateOf(funnelOnly, "launch")).toBe("todo");
  });
});

describe("wizard signals that screens may not have", () => {
  it("reports unknown rather than guessing when the configuration is absent", () => {
    const steps = buildWizard({ operationalSummary: summary({}) });
    expect(stateOf(steps, "pages")).toBe("unknown");
  });

  it("uses supplied counts when a screen knows them", () => {
    const steps = buildWizard({
      operationalSummary: summary({}),
      enabledSectionCount: 6,
    });
    expect(stateOf(steps, "pages")).toBe("complete");
  });

  it("marks zero counts as outstanding work, not unknown", () => {
    const steps = buildWizard({
      operationalSummary: summary({}),
      enabledSectionCount: 0,
    });
    expect(stateOf(steps, "pages")).not.toBe("unknown");
  });

  it("follows the homepage sections that publish, so Configuration edits land here", () => {
    const sections = [
      { ...createAstroHomepageSection("hero", "section-hero"), enabled: true },
      createAstroHomepageSection("faq", "section-faq"),
    ];

    const enabled = buildWizard({
      operationalSummary: summary({}),
      enabledSectionCount: summarizeHomepageSections(sections).enabled,
    });
    expect(stateOf(enabled, "pages")).toBe("complete");

    const allHidden = buildWizard({
      operationalSummary: summary({}),
      enabledSectionCount: summarizeHomepageSections(
        sections.map(section => ({ ...section, enabled: false })),
      ).enabled,
    });
    expect(stateOf(allHidden, "pages")).not.toBe("complete");
  });
});

describe("wizard current step", () => {
  it("points at the earliest outstanding step", () => {
    const steps = buildWizard({
      operationalSummary: summary({ businessInformation: true }),
    });
    const current = steps.filter(step => step.state === "current");

    expect(current).toHaveLength(1);
    expect(current[0].step).toBe("brandContent");
  });

  it("explains why the current step is outstanding", () => {
    const steps = buildWizard({
      operationalSummary: summary({}, "setup_needed", ["GHL_API_KEY"]),
    });
    const current = steps.find(step => step.state === "current");
    expect(current?.blockedBy).toBeTruthy();
  });

  it("names the missing credentials on the integrations step", () => {
    const steps = buildWizard({
      operationalSummary: summary(
        { businessInformation: true, websiteSetup: true },
        "setup_needed",
        ["META_ACCESS_TOKEN"],
      ),
      enabledSectionCount: 3,
    });
    const integrations = steps.find(step => step.step === "integrations");
    expect(integrations?.blockedBy).toContain("META_ACCESS_TOKEN");
  });
});

describe("wizard progress", () => {
  it("counts only completed steps", () => {
    const steps = buildWizard({
      operationalSummary: summary({
        businessInformation: true,
        websiteSetup: true,
      }),
    });
    const progress = wizardProgress(steps);

    expect(progress.total).toBe(6);
    expect(progress.complete).toBe(3);
    expect(progress.percent).toBe(50);
  });

  it("reports zero for an untouched client", () => {
    expect(wizardProgress(buildWizard({ operationalSummary: summary({}) })).complete).toBe(
      0,
    );
  });
});
