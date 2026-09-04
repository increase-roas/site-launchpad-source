import {
  type SetupSignal,
  type WizardSignals,
} from "@/app/wizard";
import { summarizeHomepageSections } from "@shared/astroConfig";
import type { AstroClientConfigInput, WranglerSecretName } from "@shared/astroConfig";
import {
  CONFIG_TAB_SECTIONS,
  describeTabGap,
  summarizeAstroConfigReadiness,
  type ConfigReadiness,
  type ConfigTabId,
} from "@shared/astroConfigReadiness";
import type { OperationalSummary } from "@shared/operationalSummary";

export type OverviewWizardInput = {
  operationalSummary: OperationalSummary;
  config?: AstroClientConfigInput;
  assets?: Array<{ slot: string }>;
  secretStatus?: Partial<Record<WranglerSecretName, boolean>>;
  funnelCount?: number;
};

function tabSetup(readiness: ConfigReadiness, tab: ConfigTabId): SetupSignal {
  const summary = readiness.tabs[tab];
  return {
    complete: summary.state === "complete",
    blockedBy: describeTabGap(readiness, tab),
    filled: summary.requiredFilled,
    total: summary.requiredTotal,
    details: CONFIG_TAB_SECTIONS[tab].map(id => {
      const section = readiness.sections[id];
      return {
        label: section.label,
        state: section.state,
        note:
          section.requiredTotal === 0
            ? "Nothing required"
            : `${section.requiredFilled} of ${section.requiredTotal}`,
      };
    }),
  };
}

function pagesSetup(
  readiness: ConfigReadiness,
  enabledSectionCount: number,
): SetupSignal {
  const content = tabSetup(readiness, "content");
  if (enabledSectionCount === 0) {
    return {
      ...content,
      complete: false,
      blockedBy: "No homepage sections are visible",
    };
  }
  return content;
}

/**
 * Overview has the live config document, so it can score every configuration
 * tab instead of falling back to the coarse client-list summary.
 */
export function buildOverviewWizardSignals(
  input: OverviewWizardInput,
): WizardSignals {
  const readiness = input.config
    ? summarizeAstroConfigReadiness(
        input.config,
        input.assets ?? [],
        input.secretStatus,
      )
    : undefined;
  const enabledSectionCount = input.config
    ? summarizeHomepageSections(input.config.homepageSections).enabled
    : undefined;

  return {
    operationalSummary: input.operationalSummary,
    enabledSectionCount,
    funnelCount: input.funnelCount,
    basicSetup: readiness ? tabSetup(readiness, "basic") : undefined,
    brandSetup: readiness ? tabSetup(readiness, "branding") : undefined,
    mediaSetup: readiness ? tabSetup(readiness, "media") : undefined,
    pagesSetup:
      readiness && enabledSectionCount !== undefined
        ? pagesSetup(readiness, enabledSectionCount)
        : undefined,
    integrationsSetup:
      readiness && input.secretStatus
        ? tabSetup(readiness, "technical")
        : undefined,
  };
}
