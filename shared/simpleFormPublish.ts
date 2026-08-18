export const funnelPublishStepValues = [
  "create_repository",
  "ensure_kv_namespace",
  "ensure_d1_database",
  "ensure_queues",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "get_live_url",
  "published",
] as const;
export type FunnelPublishStep = (typeof funnelPublishStepValues)[number];

export const funnelPublishStatusValues = [
  "pending",
  "running",
  "failed",
  "published",
] as const;
export type FunnelPublishStatus = (typeof funnelPublishStatusValues)[number];

export const SIMPLE_FORM_PUBLISH_EXTERNAL_STEP_COUNT =
  funnelPublishStepValues.length - 1;

const RESOURCE_NAME_MAX_LENGTH = 63;

function resourceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SimpleFormPublishResourceNames = {
  externalFunnelId: string;
  resourceName: string;
  repositoryName: string;
  workerName: string;
};

export function simpleFormPublishResourceNames(
  clientShortName: string,
  funnelId: number
): SimpleFormPublishResourceNames {
  if (!Number.isInteger(funnelId) || funnelId <= 0) {
    throw new Error("A positive funnel ID is required for publishing.");
  }
  const prefix = "simple-form-";
  const suffix = `-${funnelId}`;
  const available = RESOURCE_NAME_MAX_LENGTH - prefix.length - suffix.length;
  const clientSlug = (resourceSlug(clientShortName) || "client").slice(
    0,
    Math.max(1, available)
  );
  const resourceName = `${prefix}${clientSlug}${suffix}`;
  return {
    externalFunnelId: `simple-form-funnel-${funnelId}`,
    resourceName,
    repositoryName: resourceName,
    workerName: resourceName,
  };
}

export function simpleFormPublishProgress(step: FunnelPublishStep): {
  completed: number;
  total: number;
} {
  const index = funnelPublishStepValues.indexOf(step);
  return {
    completed: Math.min(
      Math.max(index, 0),
      SIMPLE_FORM_PUBLISH_EXTERNAL_STEP_COUNT
    ),
    total: SIMPLE_FORM_PUBLISH_EXTERNAL_STEP_COUNT,
  };
}

export type SimpleFormPublishStatusView = {
  id: string;
  status: FunnelPublishStatus;
  step: FunnelPublishStep;
  progress: {
    completed: number;
    total: number;
  };
  error: string | null;
  externalFunnelId: string;
  repositoryName: string;
  workerName: string;
  repositoryUrl: string | null;
  liveUrl: string | null;
  dispatchRequestedAt: Date | null;
  workflowRunId: string | null;
  workflowStatus: string | null;
  completedAt: Date | null;
  updatedAt: Date;
};
