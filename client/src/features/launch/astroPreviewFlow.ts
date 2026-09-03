import type {
  AstroSitePreviewStatusView,
  AstroSitePreviewStep,
} from "@shared/astroSitePreview";
import { astroSitePreviewStepLabel } from "@shared/astroSitePreview";

export type PreviewState = AstroSitePreviewStatusView | null | undefined;

const POLL_INTERVAL_MS = 3_000;
const WORKFLOW_SETTLE_MS = 2_000;

export function isPreviewActive(preview: PreviewState): boolean {
  return preview?.status === "pending" || preview?.status === "running";
}

export function previewPollIntervalMs(preview: PreviewState): number | false {
  return isPreviewActive(preview) ? POLL_INTERVAL_MS : false;
}

export function previewAdvanceDelayMs(preview: PreviewState): number | null {
  if (!preview || !isPreviewActive(preview) || preview.step === "ready") {
    return null;
  }
  const awaitingWorkflow =
    preview.step === "monitor_workflow" ||
    (preview.step === "dispatch_workflow" && preview.dispatchRequestedAt !== null);
  return awaitingWorkflow ? WORKFLOW_SETTLE_MS : 0;
}

export function previewPercent(progress: { completed: number; total: number }): number {
  if (progress.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)));
}

export function previewStepLabel(step: AstroSitePreviewStep): string {
  return astroSitePreviewStepLabel(step);
}

export function previewStartsFreshJob(preview: PreviewState): boolean {
  if (!preview) return true;
  switch (preview.status) {
    case "failed":
    case "ready":
      return true;
    case "pending":
    case "running":
      return false;
    default: {
      const exhaustive: never = preview.status;
      return exhaustive;
    }
  }
}

export function previewActionLabel(preview: PreviewState): string {
  if (!preview) return "Generate Preview";
  if (preview.status === "ready" && preview.stale) return "Update Preview";
  if (preview.status === "failed") return "Retry Preview";
  if (isPreviewActive(preview)) return "Generating Preview";
  if (preview.status === "ready") return "Update Preview";
  return "Generate Preview";
}
