import type { LaunchCheck } from "./launchChecks";
import type {
  PreviewEnvironmentKind,
  PublishEnvironmentKind,
} from "./launchPipeline";

export type LaunchAlertTone = "danger" | "warning" | "info";

export type LaunchAlert = {
  key: string;
  tone: LaunchAlertTone;
  title: string;
  detail: string;
};

export function isPreviewWorkerUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const worker = new URL(url).hostname.split(".")[0] ?? "";
    return worker.endsWith("-preview");
  } catch {
    return false;
  }
}

export function sameSiteUrl(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false;
  try {
    const a = new URL(left);
    const b = new URL(right);
    return (
      a.host === b.host &&
      a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "")
    );
  } catch {
    return false;
  }
}

/** Production must not reuse the preview Worker address. */
export function resolveProductionLiveUrl(
  liveUrl: string | null | undefined,
  previewUrl: string | null | undefined,
): string | null {
  const candidate = liveUrl?.trim() || null;
  if (!candidate) return null;
  if (sameSiteUrl(candidate, previewUrl) || isPreviewWorkerUrl(candidate)) {
    return null;
  }
  return candidate;
}

export function previewEnvironmentAlerts({
  kind,
  error,
  warningCount,
  hasPreviewUrl,
  approved,
}: {
  kind: PreviewEnvironmentKind;
  error: string | null;
  warningCount: number;
  hasPreviewUrl: boolean;
  approved: boolean;
}): LaunchAlert[] {
  const alerts: LaunchAlert[] = [];

  switch (kind) {
    case "failed":
      alerts.push({
        key: "preview-failed",
        tone: "danger",
        title: "Preview failed",
        detail: error ?? "The last preview job did not finish. Retry after reviewing the error.",
      });
      break;
    case "idle":
      alerts.push({
        key: "preview-missing",
        tone: "warning",
        title: "No preview yet",
        detail:
          "Generate a preview to review the site on a staging Worker before it goes live.",
      });
      break;
    case "stale":
      alerts.push({
        key: "preview-stale",
        tone: "warning",
        title: "Preview is out of date",
        detail:
          "The saved configuration is newer than this preview. Update it before approving or publishing.",
      });
      break;
    case "ready":
      if (!hasPreviewUrl) {
        alerts.push({
          key: "preview-url-missing",
          tone: "warning",
          title: "Preview URL is missing",
          detail: "The job finished, but no preview address was recorded. Generate again.",
        });
      } else if (!approved) {
        alerts.push({
          key: "preview-unapproved",
          tone: "info",
          title: "Preview is not approved",
          detail: "Open the preview, then approve it when it is the version you want live.",
        });
      }
      break;
    case "active":
    case "unknown":
      break;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }

  if (warningCount > 0 && kind !== "failed" && kind !== "unknown") {
    alerts.push({
      key: "preview-warnings",
      tone: "warning",
      title:
        warningCount === 1
          ? "1 setup warning"
          : `${warningCount} setup warnings`,
      detail:
        "Optional setup is incomplete. These do not block preview, but they will show on the site.",
    });
  }

  return alerts;
}

export function productionEnvironmentAlerts({
  kind,
  error,
  hasLiveUrl,
  previewKind,
  approved,
  blockers,
  liveUrlIsPreview = false,
  liveUrlIsWorkersDev = false,
}: {
  kind: PublishEnvironmentKind;
  error: string | null;
  hasLiveUrl: boolean;
  previewKind: PreviewEnvironmentKind;
  approved: boolean;
  blockers: readonly Pick<LaunchCheck, "label">[];
  liveUrlIsPreview?: boolean;
  liveUrlIsWorkersDev?: boolean;
}): LaunchAlert[] {
  const alerts: LaunchAlert[] = [];

  switch (kind) {
    case "failed":
      alerts.push({
        key: "production-failed",
        tone: "danger",
        title: "Publish failed",
        detail: error ?? "The last production job did not finish. Review the error, then retry.",
      });
      break;
    case "idle":
      if (liveUrlIsPreview) {
        alerts.push({
          key: "production-same-as-preview",
          tone: "warning",
          title: "Production is still the preview address",
          detail:
            "The preview Worker host ends in -preview. Publish production to get the live Worker without that suffix.",
        });
      } else if (!hasLiveUrl) {
        alerts.push({
          key: "production-missing",
          tone: "warning",
          title: "Website is not published",
          detail: "Production has no live Worker yet. Publish after the preview is approved.",
        });
      }
      break;
    case "live":
      if (!hasLiveUrl) {
        alerts.push({
          key: "production-url-missing",
          tone: "warning",
          title: "Live URL is missing",
          detail: "The site is marked published, but no production address was recorded.",
        });
      } else if (liveUrlIsWorkersDev) {
        alerts.push({
          key: "production-workers-dev",
          tone: "warning",
          title: "Site URL is not connected yet",
          detail:
            "Production is live on workers.dev. Publish again to attach the Site URL to this Worker.",
        });
      }
      break;
    case "active":
    case "unknown":
      break;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }

  if (kind === "unknown") {
    return alerts;
  }

  if (kind !== "active" && kind !== "failed" && blockers.length > 0) {
    const labels = blockers.map(check => check.label).join(", ");
    alerts.push({
      key: "production-blockers",
      tone: "warning",
      title:
        blockers.length === 1
          ? "1 item still blocks a clean publish"
          : `${blockers.length} items still block a clean publish`,
      detail: labels,
    });
  }

  if (kind !== "active" && kind !== "failed") {
    switch (previewKind) {
      case "idle":
        alerts.push({
          key: "production-needs-preview",
          tone: "warning",
          title: "No approved preview to publish",
          detail: "Generate a preview first, then approve it before publishing production.",
        });
        break;
      case "failed":
        alerts.push({
          key: "production-preview-failed",
          tone: "warning",
          title: "Preview is not ready",
          detail: "Fix the failed preview before publishing a new production build.",
        });
        break;
      case "stale":
        alerts.push({
          key: "production-preview-stale",
          tone: "warning",
          title: "Production may be behind",
          detail:
            "The preview is out of date. Update and approve it before publishing again.",
        });
        break;
      case "ready":
        if (!approved) {
          alerts.push({
            key: "production-preview-unapproved",
            tone: "warning",
            title: "Preview is not approved",
            detail: "Approve the current preview so production publishes the version you reviewed.",
          });
        }
        break;
      case "active":
        alerts.push({
          key: "production-preview-active",
          tone: "info",
          title: "Preview is still generating",
          detail: "Wait for the preview to finish before publishing production.",
        });
        break;
      case "unknown":
        break;
      default: {
        const exhaustive: never = previewKind;
        return exhaustive;
      }
    }
  }

  return alerts;
}
