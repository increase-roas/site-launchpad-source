import type {
  AstroSitePreviewStatusView,
  AstroSitePreviewStep,
} from "@shared/astroSitePreview";
import type {
  AstroSitePublishStatusView,
  AstroSitePublishStep,
} from "@shared/astroSitePublish";

export const launchPipelinePhases = [
  "prepare",
  "build",
  "deploy",
  "complete",
] as const;

export type LaunchPipelinePhase = (typeof launchPipelinePhases)[number];

export const LAUNCH_PIPELINE_PHASE_LABELS: Record<LaunchPipelinePhase, string> = {
  prepare: "Prepare",
  build: "Build",
  deploy: "Deploy",
  complete: "Live",
};

export function previewPipelinePhase(step: AstroSitePreviewStep): LaunchPipelinePhase {
  switch (step) {
    case "create_repository":
    case "ensure_d1_database":
    case "ensure_r2_bucket":
    case "commit_source":
      return "prepare";
    case "dispatch_workflow":
    case "monitor_workflow":
      return "build";
    case "patch_runtime_secrets":
    case "verify_preview":
      return "deploy";
    case "ready":
      return "complete";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export function publishPipelinePhase(step: AstroSitePublishStep): LaunchPipelinePhase {
  switch (step) {
    case "create_repository":
    case "ensure_d1_database":
    case "ensure_r2_bucket":
    case "commit_source":
      return "prepare";
    case "dispatch_workflow":
    case "monitor_workflow":
      return "build";
    case "patch_runtime_secrets":
    case "get_live_url":
    case "attach_custom_domain":
      return "deploy";
    case "published":
      return "complete";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export function pipelinePhaseIndex(phase: LaunchPipelinePhase): number {
  return launchPipelinePhases.indexOf(phase);
}

export type PipelineJobKind = "idle" | "active" | "failed" | "complete";

export type PipelinePhaseVisualState = "done" | "current" | "todo" | "failed";

export type PreviewEnvironmentKind =
  | "unknown"
  | "idle"
  | "active"
  | "failed"
  | "ready"
  | "stale";

export type PublishEnvironmentKind = "unknown" | "idle" | "active" | "failed" | "live";

export function previewEnvironmentKind(
  preview: AstroSitePreviewStatusView | null | undefined,
): PreviewEnvironmentKind {
  if (preview === undefined) return "unknown";
  if (preview === null) return "idle";
  switch (preview.status) {
    case "pending":
    case "running":
      return "active";
    case "failed":
      return "failed";
    case "ready":
      return preview.stale ? "stale" : "ready";
    default: {
      const exhaustive: never = preview.status;
      return exhaustive;
    }
  }
}

export function publishEnvironmentKind(
  publish: AstroSitePublishStatusView | null | undefined,
): PublishEnvironmentKind {
  if (publish === undefined) return "unknown";
  if (publish === null) return "idle";
  switch (publish.status) {
    case "pending":
    case "running":
      return "active";
    case "failed":
      return "failed";
    case "published":
      return "live";
    default: {
      const exhaustive: never = publish.status;
      return exhaustive;
    }
  }
}

export function previewPipelineJobKind(
  kind: PreviewEnvironmentKind,
): PipelineJobKind {
  switch (kind) {
    case "unknown":
    case "idle":
      return "idle";
    case "active":
      return "active";
    case "failed":
      return "failed";
    case "ready":
    case "stale":
      return "complete";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function publishPipelineJobKind(
  kind: PublishEnvironmentKind,
): PipelineJobKind {
  switch (kind) {
    case "unknown":
    case "idle":
      return "idle";
    case "active":
      return "active";
    case "failed":
      return "failed";
    case "live":
      return "complete";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function pipelinePhaseVisualState(
  phase: LaunchPipelinePhase,
  current: LaunchPipelinePhase,
  job: PipelineJobKind,
): PipelinePhaseVisualState {
  switch (job) {
    case "idle":
      return "todo";
    case "complete":
      return "done";
    case "active":
    case "failed": {
      const phaseIndex = pipelinePhaseIndex(phase);
      const currentIndex = pipelinePhaseIndex(current);
      if (phaseIndex < currentIndex) return "done";
      if (phaseIndex > currentIndex) return "todo";
      return job === "failed" ? "failed" : "current";
    }
    default: {
      const exhaustive: never = job;
      return exhaustive;
    }
  }
}
