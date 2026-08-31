import type {
  AstroSitePublishStatusView,
  AstroSitePublishStep,
} from "@shared/astroSitePublish";

/**
 * Drives the website publish job from the Launch tab. The job advances one step
 * per request, so the page polls while a job is live and re-issues `advance`
 * until the pipeline reports a terminal state.
 */

export type PublishState = AstroSitePublishStatusView | null | undefined;

const POLL_INTERVAL_MS = 3_000;
/** Give GitHub a moment before asking about a workflow we just dispatched. */
const WORKFLOW_SETTLE_MS = 2_000;

export function isPublishActive(publish: PublishState): boolean {
  return publish?.status === "pending" || publish?.status === "running";
}

export function publishPollIntervalMs(publish: PublishState): number | false {
  return isPublishActive(publish) ? POLL_INTERVAL_MS : false;
}

/** Milliseconds to wait before advancing, or null when the job must not advance. */
export function publishAdvanceDelayMs(publish: PublishState): number | null {
  if (!publish || !isPublishActive(publish) || publish.step === "published") {
    return null;
  }
  const awaitingWorkflow =
    publish.step === "monitor_workflow" ||
    (publish.step === "dispatch_workflow" && publish.dispatchRequestedAt !== null);
  return awaitingWorkflow ? WORKFLOW_SETTLE_MS : 0;
}

export function publishPercent(progress: { completed: number; total: number }): number {
  if (progress.total <= 0) return 0;
  const ratio = progress.completed / progress.total;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function publishStepLabel(step: AstroSitePublishStep): string {
  return step.replaceAll("_", " ");
}
