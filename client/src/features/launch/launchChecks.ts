import { trackedOperationalItems } from "@/lib/clientBoard";
import { configurationRoute, integrationsRoute } from "@/lib/workspaceNavigation";
import type { OperationalSummary } from "@shared/operationalSummary";

/**
 * The single pre-launch check list. Overview links here rather than repeating
 * these rows, so this module is the only place readiness is spelled out
 * item by item. Deferred capabilities contribute no check: a website must not
 * wait on a campaign that operators cannot publish yet.
 */

export type LaunchCheckState = "pass" | "fail" | "pending";

export type LaunchCheck = {
  key: string;
  label: string;
  detail: string;
  state: LaunchCheckState;
  fixHref: string;
};

export type LaunchChecksInput = {
  clientId: number;
  summary: OperationalSummary;
  /** Absent until workspace data loads, which keeps the check `pending`. */
  homepageSections?: { enabled: number; total: number };
};

export function buildLaunchChecks(input: LaunchChecksInput): LaunchCheck[] {
  const { clientId, summary, homepageSections } = input;
  const runtime = summary.runtimeConfiguration;

  return [
    ...trackedOperationalItems(summary).map(item => ({
      key: item.key,
      label: item.label,
      detail: item.complete ? "Complete" : "Outstanding",
      state: item.complete ? ("pass" as const) : ("fail" as const),
      fixHref: configurationRoute(clientId),
    })),
    {
      key: "runtimeSecrets",
      label: "Required runtime secrets",
      detail: runtime.blocksLaunch
        ? `Missing ${runtime.requiredMissing.join(", ")}`
        : `${runtime.set} of ${runtime.total} present`,
      state: runtime.blocksLaunch ? "fail" : "pass",
      fixHref: integrationsRoute(clientId),
    },
    {
      key: "homepageSections",
      label: "Homepage has visible sections",
      detail: homepageSections
        ? `${homepageSections.enabled} of ${homepageSections.total} sections visible`
        : "Checking…",
      state: !homepageSections
        ? "pending"
        : homepageSections.enabled > 0
          ? "pass"
          : "fail",
      fixHref: configurationRoute(clientId, "content"),
    },
  ];
}

export type LaunchReadiness = {
  passed: number;
  total: number;
  failing: number;
  pending: number;
  /** True only when every check has reported and none failed. */
  ready: boolean;
};

/**
 * Failing checks are lifted out so the page can lead with what blocks launch
 * instead of burying it under a list that mostly passes.
 */
export function launchBlockers(checks: readonly LaunchCheck[]): LaunchCheck[] {
  return checks.filter(check => check.state === "fail");
}

export function launchReadiness(checks: readonly LaunchCheck[]): LaunchReadiness {
  let passed = 0;
  let failing = 0;
  let pending = 0;
  for (const check of checks) {
    switch (check.state) {
      case "pass":
        passed += 1;
        break;
      case "fail":
        failing += 1;
        break;
      case "pending":
        pending += 1;
        break;
      default: {
        const exhaustive: never = check.state;
        throw new Error(`Unhandled launch check state: ${String(exhaustive)}`);
      }
    }
  }
  return {
    passed,
    total: checks.length,
    failing,
    pending,
    ready: failing === 0 && pending === 0,
  };
}
