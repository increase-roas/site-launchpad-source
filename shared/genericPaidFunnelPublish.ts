export const genericPaidFunnelPublishStepValues = [
  "create_repository",
  "ensure_resources",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "get_live_url",
  "published",
] as const;

export type GenericPaidFunnelPublishStep =
  (typeof genericPaidFunnelPublishStepValues)[number];

export const genericPaidFunnelPublishStatusValues = [
  "pending",
  "running",
  "failed",
  "published",
] as const;

export type GenericPaidFunnelPublishStatus =
  (typeof genericPaidFunnelPublishStatusValues)[number];

export type GenericPaidFunnelResourceDefinitions = {
  d1: Array<{ binding: string; name: string }>;
};

export type GenericPaidFunnelProvisionedResources = {
  d1: Array<{ binding: string; name: string; id: string }>;
};

const RESOURCE_NAME_MAX_LENGTH = 63;

function resourceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function genericPaidFunnelResourceNames(
  clientShortName: string,
  funnelId: number,
): {
  externalFunnelId: string;
  resourceName: string;
  repositoryName: string;
  workerName: string;
} {
  if (!Number.isInteger(funnelId) || funnelId <= 0) {
    throw new Error("A positive funnel ID is required for publishing.");
  }
  const suffix = `-${funnelId}`;
  const prefix = "funnel-";
  const available = RESOURCE_NAME_MAX_LENGTH - prefix.length - suffix.length;
  const clientSlug = (resourceSlug(clientShortName) || "client").slice(
    0,
    Math.max(1, available),
  );
  const resourceName = `${prefix}${clientSlug}${suffix}`;
  return {
    externalFunnelId: `generic-paid-funnel-${funnelId}`,
    resourceName,
    repositoryName: resourceName,
    workerName: resourceName,
  };
}

export function genericPaidFunnelPublishProgress(
  step: GenericPaidFunnelPublishStep,
): { completed: number; total: number } {
  const total = genericPaidFunnelPublishStepValues.length - 1;
  const index = genericPaidFunnelPublishStepValues.indexOf(step);
  return { completed: Math.min(Math.max(index, 0), total), total };
}

export type GenericPaidFunnelPublishStatusView = {
  id: string;
  status: GenericPaidFunnelPublishStatus;
  step: GenericPaidFunnelPublishStep;
  progress: { completed: number; total: number };
  error: string | null;
  funnelId: number;
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
