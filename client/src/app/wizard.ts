import { CAMPAIGNS_DEFERRED } from "@/lib/deferredFeatures";
import type { OperationalSummary } from "@shared/operationalSummary";
import { CLIENT_TAB_DEFINITIONS } from "./clientTabs";

/**
 * The build path a client moves through. Step state is derived from real
 * readiness signals; where a signal is genuinely unavailable the step is
 * reported as `unknown` rather than guessed at. Campaigns are absent while the
 * tab is deferred, because a step nobody can finish is not progress.
 */
export const WIZARD_STEPS = [
  "clientSetup",
  "brandContent",
  "mediaGallery",
  "pages",
  "funnels",
  "integrations",
  "launch",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export type WizardStepState = "complete" | "current" | "todo" | "unknown";

export type WizardStepDefinition = {
  step: WizardStep;
  index: number;
  label: string;
  caption: string;
};

/**
 * Steps that are a whole tab borrow that tab's label so the two can never drift
 * apart. Steps that live inside the Configuration tab are named after the
 * sub-tab that owns them.
 */
export const WIZARD_STEP_DEFINITIONS: Record<WizardStep, WizardStepDefinition> = {
  clientSetup: {
    step: "clientSetup",
    index: 1,
    label: "Client setup",
    caption: "Add & configure",
  },
  brandContent: {
    step: "brandContent",
    index: 2,
    label: "Brand & content",
    caption: "Logo, colors, copy",
  },
  mediaGallery: {
    step: "mediaGallery",
    index: 3,
    label: "Media",
    caption: "Images & assets",
  },
  pages: {
    step: "pages",
    index: 4,
    label: CLIENT_TAB_DEFINITIONS.pages.label,
    caption: "Build content",
  },
  funnels: {
    step: "funnels",
    index: 5,
    label: CLIENT_TAB_DEFINITIONS.campaigns.label,
    caption: "Offer & content",
  },
  integrations: {
    step: "integrations",
    index: 6,
    label: CLIENT_TAB_DEFINITIONS.integrations.label,
    caption: "Connect services",
  },
  launch: {
    step: "launch",
    index: 7,
    label: CLIENT_TAB_DEFINITIONS.launch.label,
    caption: "Check & go live",
  },
};

export const WIZARD_STEP_LIST: WizardStepDefinition[] = WIZARD_STEPS.map(
  step => WIZARD_STEP_DEFINITIONS[step],
);

/**
 * The path as an operator sees it today. A deferred tab contributes no step,
 * and the remainder is renumbered so the tiles still read 1, 2, 3 with no gap.
 */
export function activeWizardSteps(): WizardStepDefinition[] {
  return WIZARD_STEP_LIST.filter(
    definition => definition.step !== "funnels" || !CAMPAIGNS_DEFERRED,
  ).map((definition, position) => ({ ...definition, index: position + 1 }));
}

/**
 * Signals a screen can supply. `operationalSummary` is always available from the
 * client list; the counts are only known on screens that load workspace data, so
 * they are optional and produce `unknown` when absent.
 */
export type WizardSignals = {
  operationalSummary: OperationalSummary;
  enabledSectionCount?: number;
  funnelCount?: number;
};

function itemComplete(
  summary: OperationalSummary,
  key: string,
): boolean | undefined {
  const item = summary.items.find(entry => entry.key === key);
  return item ? item.complete : undefined;
}

function toState(complete: boolean | undefined): WizardStepState {
  if (complete === undefined) return "unknown";
  return complete ? "complete" : "todo";
}

export type WizardStepStatus = WizardStepDefinition & {
  state: WizardStepState;
  /** Why the step is not complete, when that is known. */
  blockedBy?: string;
};

export function buildWizard(signals: WizardSignals): WizardStepStatus[] {
  const summary = signals.operationalSummary;

  const businessInformation = itemComplete(summary, "businessInformation");
  const websiteSetup = itemComplete(summary, "websiteSetup");
  const websiteIntegrations = itemComplete(summary, "websiteIntegrations");
  const funnelIntegrations = itemComplete(summary, "funnelIntegrations");
  const websiteLive = itemComplete(summary, "websiteLive");
  const funnelsLive = itemComplete(summary, "funnelsLive");

  // Campaign readiness still arrives from the server, but while campaigns are
  // deferred it cannot be acted on, so it is not allowed to hold a step open.
  const integrationsComplete = CAMPAIGNS_DEFERRED
    ? websiteIntegrations
    : websiteIntegrations === undefined || funnelIntegrations === undefined
      ? undefined
      : websiteIntegrations && funnelIntegrations;
  const launchComplete = CAMPAIGNS_DEFERRED
    ? websiteLive
    : websiteLive === undefined || funnelsLive === undefined
      ? undefined
      : websiteLive || funnelsLive;

  const pagesState: WizardStepState =
    signals.enabledSectionCount === undefined
      ? "unknown"
      : signals.enabledSectionCount > 0
        ? "complete"
        : "todo";

  const funnelsState: WizardStepState =
    signals.funnelCount === undefined
      ? "unknown"
      : signals.funnelCount > 0
        ? "complete"
        : "todo";

  const states: Record<WizardStep, WizardStepState> = {
    clientSetup: toState(businessInformation),
    // Theme and required photos are reported together, so both steps read it.
    brandContent: toState(websiteSetup),
    mediaGallery: toState(websiteSetup),
    pages: pagesState,
    funnels: funnelsState,
    integrations: toState(integrationsComplete),
    launch: toState(launchComplete),
  };

  const blockers: Partial<Record<WizardStep, string>> = {
    clientSetup: "Business details are incomplete",
    brandContent: "Theme or required photos are missing",
    mediaGallery: "Required photos are missing",
    pages: "No homepage sections are visible",
    funnels: "No funnel has been created",
    integrations: summary.runtimeConfiguration.requiredMissing.length
      ? `Missing ${summary.runtimeConfiguration.requiredMissing.join(", ")}`
      : "Required integrations are not connected",
    launch: "Nothing has been published",
  };

  const visible = activeWizardSteps();
  // The first incomplete step with a known state becomes the current one.
  const firstIncomplete = visible.find(
    definition => states[definition.step] === "todo",
  )?.step;

  return visible.map(definition => {
    const state =
      definition.step === firstIncomplete ? "current" : states[definition.step];
    return {
      ...definition,
      state,
      blockedBy:
        state === "todo" || state === "current"
          ? blockers[definition.step]
          : undefined,
    };
  });
}

export function wizardProgress(steps: readonly WizardStepStatus[]): {
  complete: number;
  total: number;
  percent: number;
} {
  const complete = steps.filter(step => step.state === "complete").length;
  const total = steps.length;
  return {
    complete,
    total,
    percent: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}
