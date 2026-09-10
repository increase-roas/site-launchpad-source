import { isWorkersDevUrl } from "./liveSiteHostname";

export const astroSitePublishStepValues = [
  "create_repository",
  "ensure_d1_database",
  "ensure_r2_bucket",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "get_live_url",
  "attach_custom_domain",
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

export type AstroSitePublishContract = {
  templateKey: string;
  templateRepo: string;
  contractVersion: number;
};

function templateRepoName(repo: string): string {
  const name = repo.trim().split("/").pop() ?? "";
  return name.toLowerCase();
}

/**
 * An existing publish job can keep going when only the GitHub owner changed.
 * The generated Worker is the same template; a renamed org must not block
 * connecting the live domain.
 */
export function astroSitePublishContractConflicts(
  job: AstroSitePublishContract,
  expected: AstroSitePublishContract,
): boolean {
  if (job.templateKey !== expected.templateKey) return true;
  if (job.contractVersion !== expected.contractVersion) return true;
  return templateRepoName(job.templateRepo) !== templateRepoName(expected.templateRepo);
}

export type AstroSitePublishStartState = {
  status: AstroSitePublishStatus;
  step: AstroSitePublishStep;
  liveUrl: string | null;
  templateRepo: string;
};

export type AstroSitePublishStartPatch = {
  templateRepo?: string;
  step: AstroSitePublishStep;
  status: "pending";
  completedAt: null;
  lastError: null;
  leaseToken?: null;
  leaseUntil?: null;
  commitSha?: null;
  dispatchRequestedAt?: null;
  workflowRunId?: null;
  workflowStatus?: null;
  workflowCheckedAt?: null;
  runtimeSecretsPatchedAt?: null;
};

/** Restart a finished live site, or only reopen workers.dev to attach a domain. */
export function astroSitePublishStartPatch(
  job: AstroSitePublishStartState,
  input: { templateRepo: string },
): AstroSitePublishStartPatch | null {
  const refreshTemplateRepo = job.templateRepo !== input.templateRepo;
  const connectLiveDomain =
    job.status === "published" && isWorkersDevUrl(job.liveUrl);
  const republish = job.status === "published" && !connectLiveDomain;
  if (!refreshTemplateRepo && !connectLiveDomain && !republish) return null;
  if (connectLiveDomain) {
    return {
      ...(refreshTemplateRepo ? { templateRepo: input.templateRepo } : {}),
      step: "attach_custom_domain",
      status: "pending",
      completedAt: null,
      lastError: null,
    };
  }
  return {
    ...(refreshTemplateRepo ? { templateRepo: input.templateRepo } : {}),
    step: "create_repository",
    status: "pending",
    completedAt: null,
    lastError: null,
    leaseToken: null,
    leaseUntil: null,
    commitSha: null,
    dispatchRequestedAt: null,
    workflowRunId: null,
    workflowStatus: null,
    workflowCheckedAt: null,
    runtimeSecretsPatchedAt: null,
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
