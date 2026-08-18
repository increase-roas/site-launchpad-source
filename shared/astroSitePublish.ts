export const astroSitePublishStepValues = [
  "create_repository",
  "ensure_d1_database",
  "ensure_r2_bucket",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "get_live_url",
  "published",
] as const;

export type AstroSitePublishStep =
  (typeof astroSitePublishStepValues)[number];

export const astroSitePublishStatusValues = [
  "pending",
  "running",
  "failed",
  "published",
] as const;

export type AstroSitePublishStatus =
  (typeof astroSitePublishStatusValues)[number];

const RESOURCE_NAME_MAX_LENGTH = 63;

function resourceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function astroSitePublishResourceNames(
  clientShortName: string,
  clientId: number,
): {
  externalSiteId: string;
  resourceName: string;
  repositoryName: string;
  workerName: string;
  d1DatabaseName: string;
  r2BucketName: string;
} {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error("A positive client ID is required for publishing.");
  }
  const prefix = "website-";
  const suffix = `-${clientId}`;
  // Reserve room for the longest resource suffix so deterministic D1/R2 names
  // never truncate to the same value for long client names.
  const available =
    RESOURCE_NAME_MAX_LENGTH - prefix.length - suffix.length - "-inventory".length;
  const clientSlug = (resourceSlug(clientShortName) || "client").slice(
    0,
    Math.max(1, available),
  );
  const resourceName = `${prefix}${clientSlug}${suffix}`;
  return {
    externalSiteId: `astro-site-client-${clientId}`,
    resourceName,
    repositoryName: resourceName,
    workerName: resourceName,
    d1DatabaseName: `${resourceName}-inventory`,
    r2BucketName: `${resourceName}-images`,
  };
}

export function astroSitePublishProgress(step: AstroSitePublishStep): {
  completed: number;
  total: number;
} {
  const total = astroSitePublishStepValues.length - 1;
  const index = astroSitePublishStepValues.indexOf(step);
  return { completed: Math.min(Math.max(index, 0), total), total };
}

export type AstroSitePublishStatusView = {
  id: string;
  status: AstroSitePublishStatus;
  step: AstroSitePublishStep;
  progress: { completed: number; total: number };
  error: string | null;
  externalSiteId: string;
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
