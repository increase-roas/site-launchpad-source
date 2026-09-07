import { randomUUID } from "node:crypto";
import type { AstroSitePreview } from "../../drizzle/schema";
import { ASTRO_SITE_MANIFEST } from "../../shared/astroSiteContract";
import {
  PREVIEW_ERROR_MESSAGES,
  astroSitePreviewProgress,
  astroSitePreviewResourceNames,
  pinnedPreviewTemplateSha,
  previewIsStale,
  type AstroSitePreviewErrorCode,
  type AstroSitePreviewStatusView,
  type AstroSitePreviewStep,
  type PreviewValidationIssue,
} from "../../shared/astroSitePreview";
import { createCloudflareApiClient } from "../publisher/cloudflareApi";
import {
  createGitHubApiClient,
  expectedWorkflowDisplayTitle,
} from "../publisher/githubApi";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
} from "../publisher/publisherEnv";
import {
  PublisherManualAttentionError,
  reconcilePublicTemplateRepository,
} from "../publisher/repositoryReconciliation";
import {
  astroSiteSessionKvTitle,
  commitAstroSiteGeneratedSource,
} from "../publisher/astroSiteSourceCommit";
import { astroSitePreviewStore } from "./astroSitePreviewDb";
import {
  buildAstroSitePreviewSnapshot,
  protectPreviewMaterialSnapshot,
  readPreviewMaterialSnapshot,
} from "./previewMaterial";
import { getAstroConfigView } from "../astroConfigDb";
import { syncClientPublishedMedia, type SyncClientPublishedMediaInput } from "../publishedMedia";

export type AstroSitePreviewJob = AstroSitePreview;

export type AstroSitePreviewStepValues = Partial<
  Pick<
    AstroSitePreviewJob,
    | "repositoryId"
    | "repositoryFullName"
    | "repositoryUrl"
    | "defaultBranch"
    | "d1DatabaseId"
    | "r2BucketId"
    | "r2PublicUrl"
    | "commitSha"
    | "previewUrl"
    | "dispatchRequestedAt"
    | "workflowRunId"
    | "workflowStatus"
    | "workflowCheckedAt"
    | "runtimeSecretsPatchedAt"
  >
>;

type Completion = {
  nextStep: AstroSitePreviewStep;
  values: AstroSitePreviewStepValues;
};

export interface AstroSitePreviewStore {
  start(input: {
    clientId: number;
    externalSiteId: string;
    templateKey: string;
    templateRepo: string;
    contractVersion: number;
    templateSha: string;
    clientRevision: number;
    resourceName: string;
    repositoryName: string;
    workerName: string;
    d1DatabaseName: string;
    r2BucketName: string;
    materialSnapshotEncrypted: string;
    warnings: PreviewValidationIssue[];
    now: Date;
  }): Promise<AstroSitePreviewJob>;
  getLatest(clientId: number): Promise<AstroSitePreviewJob | null>;
  getById(jobId: string): Promise<AstroSitePreviewJob | null>;
  listHistory(clientId: number): Promise<AstroSitePreviewJob[]>;
  claim(input: {
    jobId: string;
    allowFailed: boolean;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AstroSitePreviewJob | null>;
  markRepositoryCreateRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<AstroSitePreviewJob | null>;
  markDispatchRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<AstroSitePreviewJob | null>;
  complete(input: {
    jobId: string;
    leaseToken: string;
    expectedStep: AstroSitePreviewStep;
    completion: Completion;
    now: Date;
  }): Promise<AstroSitePreviewJob | null>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    message: string;
    now: Date;
    errorCode?: AstroSitePreviewErrorCode;
    resumeStep?: AstroSitePreviewStep;
    values?: AstroSitePreviewStepValues;
  }): Promise<AstroSitePreviewJob | null>;
  approve(input: {
    jobId: string;
    approvedSha: string;
    now: Date;
  }): Promise<AstroSitePreviewJob | null>;
}

type WorkflowResult = {
  workflowRunId: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "timed_out" | "action_required" | null;
  headSha: string;
  displayTitle: string;
};

export interface AstroSitePreviewExternal {
  ensureRepository(input: {
    externalSiteId: string;
    repositoryName: string;
    allowCreate: boolean;
    markCreateRequested: () => Promise<void>;
    signal: AbortSignal;
  }): Promise<Pick<AstroSitePreviewJob, "repositoryId" | "repositoryFullName" | "repositoryUrl" | "defaultBranch">>;
  ensureD1Database(input: { name: string; signal: AbortSignal }): Promise<{ d1DatabaseId: string }>;
  ensureR2Bucket(input: { name: string; signal: AbortSignal }): Promise<{ r2BucketId: string; r2PublicUrl: string }>;
  ensureKvNamespace(input: { title: string; signal: AbortSignal }): Promise<{ kvNamespaceId: string }>;
  syncActionsSecrets(input: {
    repositoryFullName: string;
    signal: AbortSignal;
  }): Promise<void>;
  commitSource(input: {
    publishJobId: string;
    clientId: number;
    clientRevision: number;
    repositoryFullName: string;
    defaultBranch: string;
    workerName: string;
    d1DatabaseName: string;
    d1DatabaseId: string;
    r2BucketName: string;
    sessionKvNamespaceId: string;
    generatedConfig: string;
    signal: AbortSignal;
  }): Promise<{ commitSha: string }>;
  dispatchWorkflow(input: {
    repositoryFullName: string;
    defaultBranch: string;
    commitSha: string;
    publishJobId: string;
    signal: AbortSignal;
  }): Promise<void>;
  findWorkflowRun(input: {
    repositoryFullName: string;
    publishJobId: string;
    sourceSha: string;
    afterWorkflowRunId: string | null;
    signal: AbortSignal;
  }): Promise<WorkflowResult | null>;
  getWorkflowRun(input: {
    repositoryFullName: string;
    workflowRunId: string;
    signal: AbortSignal;
  }): Promise<Omit<WorkflowResult, "workflowRunId">>;
  patchRuntimeSecrets(input: {
    workerName: string;
    runtimeSecrets: Record<string, string>;
    r2PublicUrl: string;
    signal: AbortSignal;
  }): Promise<void>;
  getWorkersDevStatus(input: { workerName: string; signal: AbortSignal }): Promise<{ liveUrl: string }>;
  verifyPreviewUrl(input: { url: string; signal: AbortSignal }): Promise<void>;
}

export type AstroSitePreviewDependencies = {
  store: AstroSitePreviewStore;
  external: AstroSitePreviewExternal;
  currentRevision(clientId: number): Promise<number>;
  now: () => Date;
  createLeaseToken: () => string;
  leaseDurationMs: number;
  externalTimeoutMs: number;
  syncPublishedMedia?: (
    input: SyncClientPublishedMediaInput,
  ) => Promise<{ generatedConfig: string }>;
};

const RECONCILIATION_WINDOW_MS = 60_000;

function requireValue(value: string | null, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function splitFullName(value: string): { owner: string; repository: string } {
  const [owner, repository, extra] = value.split("/");
  if (!owner || !repository || extra) throw new Error("Published repository name is invalid.");
  return { owner, repository };
}

async function bounded<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("Publisher external operation timed out.")),
    timeoutMs,
  );
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function assertWorkflow(result: { displayTitle: string; headSha: string }, job: AstroSitePreviewJob): void {
  const sourceSha = requireValue(job.commitSha, "Preview source commit is missing.");
  if (
    result.displayTitle !== expectedWorkflowDisplayTitle(job.id, sourceSha) ||
    result.headSha !== sourceSha
  ) {
    throw new PublisherManualAttentionError(
      "Workflow run does not match the preview job and source commit; manual attention is required.",
    );
  }
}

function errorCodeForStep(step: AstroSitePreviewStep): AstroSitePreviewErrorCode {
  switch (step) {
    case "create_repository":
      return "GITHUB_REPO_CREATE_FAILED";
    case "ensure_d1_database":
      return "D1_PROVISION_FAILED";
    case "ensure_r2_bucket":
      return "R2_PROVISION_FAILED";
    case "commit_source":
      return "CONFIG_COMMIT_FAILED";
    case "dispatch_workflow":
    case "monitor_workflow":
      return "GITHUB_ACTION_FAILED";
    case "patch_runtime_secrets":
      return "CLOUDFLARE_DEPLOY_FAILED";
    case "verify_preview":
      return "PREVIEW_HEALTHCHECK_FAILED";
    case "ready":
      return "CLOUDFLARE_DEPLOY_FAILED";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export async function toAstroSitePreviewStatus(
  job: AstroSitePreviewJob,
  currentRevision: number,
): Promise<AstroSitePreviewStatusView> {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: astroSitePreviewProgress(job.step),
    clientRevision: job.clientRevision,
    currentRevision,
    stale: previewIsStale({
      currentRevision,
      previewRevision: job.clientRevision,
    }),
    templateSha: job.templateSha,
    commitSha: job.commitSha,
    previewUrl: job.previewUrl,
    repositoryName: job.repositoryName,
    workerName: job.workerName,
    repositoryUrl: job.repositoryUrl,
    warnings: job.warnings,
    error: job.lastError,
    errorCode: job.errorCode,
    approvedSha: job.approvedSha,
    approvedAt: job.approvedAt,
    dispatchRequestedAt: job.dispatchRequestedAt,
    workflowRunId: job.workflowRunId,
    workflowStatus: job.workflowStatus,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function current(
  job: AstroSitePreviewJob,
  deps: AstroSitePreviewDependencies,
): Promise<AstroSitePreviewStatusView> {
  return toAstroSitePreviewStatus(job, await deps.currentRevision(job.clientId));
}

async function complete(
  job: AstroSitePreviewJob,
  leaseToken: string,
  completion: Completion,
  deps: AstroSitePreviewDependencies,
) {
  const result = await deps.store.complete({
    jobId: job.id,
    leaseToken,
    expectedStep: job.step,
    completion,
    now: deps.now(),
  });
  return result
    ? toAstroSitePreviewStatus(result, await deps.currentRevision(job.clientId))
    : current(job, deps);
}

function loadSnapshot(job: AstroSitePreviewJob) {
  return readPreviewMaterialSnapshot(job.materialSnapshotEncrypted);
}

async function execute(
  job: AstroSitePreviewJob,
  leaseToken: string,
  deps: AstroSitePreviewDependencies,
): Promise<AstroSitePreviewStatusView> {
  switch (job.step) {
    case "create_repository": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureRepository({
          externalSiteId: job.externalSiteId,
          repositoryName: job.repositoryName,
          allowCreate: job.repositoryCreateRequestedAt === null,
          markCreateRequested: async () => {
            const marked = await deps.store.markRepositoryCreateRequested({
              jobId: job.id,
              leaseToken,
              requestedAt: deps.now(),
            });
            if (!marked) throw new Error("Website preview lease was lost.");
          },
          signal,
        }),
      );
      return complete(job, leaseToken, { nextStep: "ensure_d1_database", values: result }, deps);
    }
    case "ensure_d1_database": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureD1Database({ name: job.d1DatabaseName, signal }),
      );
      return complete(job, leaseToken, { nextStep: "ensure_r2_bucket", values: result }, deps);
    }
    case "ensure_r2_bucket": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureR2Bucket({ name: job.r2BucketName, signal }),
      );
      return complete(job, leaseToken, { nextStep: "commit_source", values: result }, deps);
    }
    case "commit_source": {
      const material = loadSnapshot(job);
      let generatedConfig = material.generatedConfig;
      if (
        deps.syncPublishedMedia &&
        material.deployInput &&
        material.deployAssets &&
        material.deployLibrary &&
        material.usedMedia
      ) {
        const synced = await bounded(Math.max(deps.externalTimeoutMs, 60_000), signal =>
          deps.syncPublishedMedia!({
            clientId: job.clientId,
            destinationBucket: job.r2BucketName,
            publicBaseUrl: requireValue(job.r2PublicUrl, "Preview R2 public URL is missing."),
            usedMedia: material.usedMedia ?? [],
            deployInput: material.deployInput,
            deployAssets: material.deployAssets,
            deployLibrary: material.deployLibrary,
            signal,
          }),
        );
        generatedConfig = synced.generatedConfig;
      }
      const kv = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureKvNamespace({
          title: astroSiteSessionKvTitle(job.workerName),
          signal,
        }),
      );
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.commitSource({
          publishJobId: job.id,
          clientId: job.clientId,
          clientRevision: material.clientRevision,
          repositoryFullName: requireValue(job.repositoryFullName, "Preview repository is missing."),
          defaultBranch: requireValue(job.defaultBranch, "Preview repository branch is missing."),
          workerName: job.workerName,
          d1DatabaseName: job.d1DatabaseName,
          d1DatabaseId: requireValue(job.d1DatabaseId, "Preview D1 database is missing."),
          r2BucketName: job.r2BucketName,
          sessionKvNamespaceId: kv.kvNamespaceId,
          generatedConfig,
          signal,
        }),
      );
      return complete(job, leaseToken, { nextStep: "dispatch_workflow", values: result }, deps);
    }
    case "dispatch_workflow": {
      const sourceSha = requireValue(job.commitSha, "Preview source commit is missing.");
      if (job.dispatchRequestedAt) {
        const run = await bounded(deps.externalTimeoutMs, signal =>
          deps.external.findWorkflowRun({
            repositoryFullName: requireValue(job.repositoryFullName, "Preview repository is missing."),
            publishJobId: job.id,
            sourceSha,
            afterWorkflowRunId: job.workflowRunId,
            signal,
          }),
        );
        const checkedAt = deps.now();
        if (!run) {
          if (checkedAt.getTime() - job.dispatchRequestedAt.getTime() <= RECONCILIATION_WINDOW_MS) {
            return complete(job, leaseToken, {
              nextStep: "dispatch_workflow",
              values: { workflowCheckedAt: checkedAt },
            }, deps);
          }
          throw new PublisherManualAttentionError(
            "Workflow dispatch cannot be correlated; automatic redispatch is disabled.",
          );
        }
        assertWorkflow(run, job);
        return complete(job, leaseToken, {
          nextStep: "monitor_workflow",
          values: {
            workflowRunId: run.workflowRunId,
            workflowStatus: run.status,
            workflowCheckedAt: checkedAt,
          },
        }, deps);
      }
      const requestedAt = deps.now();
      const marked = await deps.store.markDispatchRequested({ jobId: job.id, leaseToken, requestedAt });
      if (!marked) return current(job, deps);
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.syncActionsSecrets({
          repositoryFullName: requireValue(marked.repositoryFullName, "Preview repository is missing."),
          signal,
        }),
      );
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.dispatchWorkflow({
          repositoryFullName: requireValue(marked.repositoryFullName, "Preview repository is missing."),
          defaultBranch: requireValue(marked.defaultBranch, "Preview repository branch is missing."),
          commitSha: sourceSha,
          publishJobId: marked.id,
          signal,
        }),
      );
      return complete(marked, leaseToken, {
        nextStep: "dispatch_workflow",
        values: { dispatchRequestedAt: requestedAt },
      }, deps);
    }
    case "monitor_workflow": {
      const run = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkflowRun({
          repositoryFullName: requireValue(job.repositoryFullName, "Preview repository is missing."),
          workflowRunId: requireValue(job.workflowRunId, "Workflow run ID is missing."),
          signal,
        }),
      );
      assertWorkflow(run, job);
      const checkedAt = deps.now();
      if (run.status !== "completed") {
        return complete(job, leaseToken, {
          nextStep: "monitor_workflow",
          values: { workflowStatus: run.status, workflowCheckedAt: checkedAt },
        }, deps);
      }
      if (run.conclusion !== "success") {
        const failed = await deps.store.fail({
          jobId: job.id,
          leaseToken,
          message: PREVIEW_ERROR_MESSAGES.ASTRO_BUILD_FAILED,
          errorCode: "ASTRO_BUILD_FAILED",
          now: checkedAt,
          resumeStep: "dispatch_workflow",
          values: {
            dispatchRequestedAt: null,
            workflowStatus: run.conclusion ?? "failure",
            workflowCheckedAt: checkedAt,
          },
        });
        return failed
          ? toAstroSitePreviewStatus(failed, await deps.currentRevision(job.clientId))
          : current(job, deps);
      }
      return complete(job, leaseToken, {
        nextStep: "patch_runtime_secrets",
        values: { workflowStatus: "success", workflowCheckedAt: checkedAt },
      }, deps);
    }
    case "patch_runtime_secrets": {
      const material = loadSnapshot(job);
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.patchRuntimeSecrets({
          workerName: job.workerName,
          runtimeSecrets: material.runtimeSecrets,
          r2PublicUrl: requireValue(job.r2PublicUrl, "R2 public URL is missing."),
          signal,
        }),
      );
      return complete(job, leaseToken, {
        nextStep: "verify_preview",
        values: { runtimeSecretsPatchedAt: deps.now() },
      }, deps);
    }
    case "verify_preview": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkersDevStatus({ workerName: job.workerName, signal }),
      );
      const url = new URL(result.liveUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev")) {
        throw new Error("A workers.dev deployment URL is required.");
      }
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.verifyPreviewUrl({ url: result.liveUrl, signal }),
      );
      return complete(job, leaseToken, { nextStep: "ready", values: { previewUrl: result.liveUrl } }, deps);
    }
    case "ready":
      return current(job, deps);
    default: {
      const exhaustive: never = job.step;
      return exhaustive;
    }
  }
}

export async function startAstroSitePreviewJob(
  input: { clientId: number; clientShortName: string; snapshotEncrypted: string; clientRevision: number; warnings: PreviewValidationIssue[] },
  deps: AstroSitePreviewDependencies,
): Promise<AstroSitePreviewStatusView> {
  const names = astroSitePreviewResourceNames(input.clientShortName, input.clientId);
  const job = await deps.store.start({
    clientId: input.clientId,
    ...names,
    templateKey: ASTRO_SITE_MANIFEST.templateKey,
    templateRepo: ASTRO_SITE_MANIFEST.repo,
    contractVersion: ASTRO_SITE_MANIFEST.contractVersion,
    templateSha: pinnedPreviewTemplateSha(),
    clientRevision: input.clientRevision,
    materialSnapshotEncrypted: input.snapshotEncrypted,
    warnings: input.warnings,
    now: deps.now(),
  });
  return toAstroSitePreviewStatus(job, input.clientRevision);
}

export async function advanceAstroSitePreview(
  input: { jobId: string; retryFailed?: boolean },
  deps: AstroSitePreviewDependencies,
): Promise<AstroSitePreviewStatusView> {
  const existing = await deps.store.getById(input.jobId);
  if (!existing) throw new Error("Website preview job not found.");
  const now = deps.now();
  const leaseToken = deps.createLeaseToken();
  const job = await deps.store.claim({
    jobId: input.jobId,
    allowFailed: input.retryFailed === true,
    leaseToken,
    now,
    leaseUntil: new Date(now.getTime() + deps.leaseDurationMs),
  });
  if (!job) return current(existing, deps);
  try {
    return await execute(job, leaseToken, deps);
  } catch (error) {
    const failed = await deps.store.fail({
      jobId: job.id,
      leaseToken,
      errorCode: errorCodeForStep(job.step),
      message: error instanceof PublisherManualAttentionError
        ? error.message
        : PREVIEW_ERROR_MESSAGES[errorCodeForStep(job.step)],
      now: deps.now(),
    });
    return failed
      ? toAstroSitePreviewStatus(failed, await deps.currentRevision(job.clientId))
      : current(job, deps);
  }
}

function createRuntimeExternal(): AstroSitePreviewExternal {
  const githubEnvironment = getGitHubPublisherEnvironment();
  const cloudflareEnvironment = getCloudflarePublisherEnvironment();
  const github = createGitHubApiClient({ token: githubEnvironment.token });
  const cloudflare = createCloudflareApiClient(cloudflareEnvironment);
  const template = splitFullName(ASTRO_SITE_MANIFEST.repo);

  return {
    async ensureRepository(input) {
      const repository = await reconcilePublicTemplateRepository({
        github,
        owner: githubEnvironment.owner,
        repository: input.repositoryName,
        templateOwner: template.owner,
        templateRepository: template.repository,
        description: `Generated Astro website ${input.externalSiteId}`,
        allowCreate: input.allowCreate,
        markCreateRequested: input.markCreateRequested,
        signal: input.signal,
      });
      return {
        repositoryId: String(repository.id),
        repositoryFullName: repository.fullName,
        repositoryUrl: repository.htmlUrl,
        defaultBranch: repository.defaultBranch,
      };
    },
    async ensureD1Database(input) {
      const database = await cloudflare.ensureD1Database(input.name, input.signal);
      return { d1DatabaseId: database.id };
    },
    async ensureR2Bucket(input) {
      const bucket = await cloudflare.ensureR2Bucket(input.name, input.signal);
      return { r2BucketId: bucket.id, r2PublicUrl: bucket.publicUrl };
    },
    async ensureKvNamespace(input) {
      const namespace = await cloudflare.ensureKvNamespace(input.title, input.signal);
      return { kvNamespaceId: namespace.id };
    },
    async syncActionsSecrets(input) {
      const repository = splitFullName(input.repositoryFullName);
      await github.putRepositoryActionsSecrets({
        ...repository,
        secrets: {
          CLOUDFLARE_API_TOKEN: cloudflareEnvironment.apiToken,
          CLOUDFLARE_ACCOUNT_ID: cloudflareEnvironment.accountId,
        },
        signal: input.signal,
      });
    },
    async commitSource(input) {
      const repository = splitFullName(input.repositoryFullName);
      const message = `Generate preview for client ${input.clientId} revision ${input.clientRevision} job ${input.publishJobId}`;
      return commitAstroSiteGeneratedSource({
        github,
        ...repository,
        branch: input.defaultBranch,
        message,
        generatedConfig: input.generatedConfig,
        wrangler: {
          workerName: input.workerName,
          d1DatabaseName: input.d1DatabaseName,
          d1DatabaseId: input.d1DatabaseId,
          r2BucketName: input.r2BucketName,
          sessionKvNamespaceId: input.sessionKvNamespaceId,
        },
        signal: input.signal,
      });
    },
    async dispatchWorkflow(input) {
      const repository = splitFullName(input.repositoryFullName);
      await github.dispatchWorkflow({
        ...repository,
        workflow: ASTRO_SITE_MANIFEST.workflow,
        ref: input.defaultBranch,
        publishJobId: input.publishJobId,
        sourceSha: input.commitSha,
        signal: input.signal,
      });
    },
    async findWorkflowRun(input) {
      const repository = splitFullName(input.repositoryFullName);
      const cursor = input.afterWorkflowRunId ? Number(input.afterWorkflowRunId) : undefined;
      const run = await github.findWorkflowRun({
        ...repository,
        workflow: ASTRO_SITE_MANIFEST.workflow,
        publishJobId: input.publishJobId,
        sourceSha: input.sourceSha,
        afterWorkflowRunId: cursor,
        signal: input.signal,
      });
      return run ? { ...run, workflowRunId: String(run.id) } : null;
    },
    async getWorkflowRun(input) {
      const repository = splitFullName(input.repositoryFullName);
      const workflowRunId = Number(input.workflowRunId);
      if (!Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
        throw new Error("Workflow run ID is invalid.");
      }
      return github.getWorkflowRun({ ...repository, workflowRunId, signal: input.signal });
    },
    async patchRuntimeSecrets(input) {
      const secrets = [
        ...Object.entries(input.runtimeSecrets).map(([name, value]) => ({ name, value })),
        { name: "R2_PUBLIC_BASE_URL", value: input.r2PublicUrl },
      ];
      await cloudflare.patchWorkerSecrets({ scriptName: input.workerName, secrets, signal: input.signal });
    },
    async getWorkersDevStatus(input) {
      const status = await cloudflare.getWorkersDevStatus({ scriptName: input.workerName, signal: input.signal });
      if (!status.enabled || !status.url) throw new Error("workers.dev is not enabled for the website Worker.");
      return { liveUrl: status.url };
    },
    async verifyPreviewUrl(input) {
      const response = await fetch(input.url, {
        redirect: "manual",
        signal: input.signal,
      });
      if (response.status < 200 || response.status >= 400) {
        throw new Error(PREVIEW_ERROR_MESSAGES.PREVIEW_HEALTHCHECK_FAILED);
      }
    },
  };
}

let configuredExternal: AstroSitePreviewExternal | null = null;
export function configureAstroSitePreviewExternal(external: AstroSitePreviewExternal): void {
  configuredExternal = external;
}

async function currentRevision(clientId: number): Promise<number> {
  const view = await getAstroConfigView(clientId);
  return view.websiteRevision;
}

function runtimeDependencies(): AstroSitePreviewDependencies {
  return {
    store: astroSitePreviewStore,
    external: configuredExternal ?? createRuntimeExternal(),
    currentRevision,
    now: () => new Date(),
    createLeaseToken: randomUUID,
    leaseDurationMs: 30_000,
    externalTimeoutMs: 15_000,
    syncPublishedMedia: syncClientPublishedMedia,
  };
}

export async function startPreview(clientId: number): Promise<AstroSitePreviewStatusView> {
  const built = await buildAstroSitePreviewSnapshot(clientId);
  return startAstroSitePreviewJob(
    {
      clientId,
      clientShortName: built.clientShortName,
      snapshotEncrypted: protectPreviewMaterialSnapshot(built.snapshot),
      clientRevision: built.snapshot.clientRevision,
      warnings: built.snapshot.warnings,
    },
    runtimeDependencies(),
  );
}

export async function advancePreview(
  clientId: number,
  retryFailed = false,
): Promise<AstroSitePreviewStatusView> {
  const job = await astroSitePreviewStore.getLatest(clientId);
  if (!job) throw new Error("Website preview job not found.");
  if (job.clientId !== clientId) throw new Error("Website preview job not found.");
  return advanceAstroSitePreview({ jobId: job.id, retryFailed }, runtimeDependencies());
}

export async function previewStatus(clientId: number): Promise<AstroSitePreviewStatusView | null> {
  const job = await astroSitePreviewStore.getLatest(clientId);
  if (!job) return null;
  return toAstroSitePreviewStatus(job, await currentRevision(clientId));
}

export async function previewHistory(clientId: number) {
  const jobs = await astroSitePreviewStore.listHistory(clientId);
  return jobs.map(job => ({
    id: job.id,
    status: job.status,
    step: job.step,
    clientRevision: job.clientRevision,
    commitSha: job.commitSha,
    templateSha: job.templateSha,
    previewUrl: job.previewUrl,
    error: job.lastError,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }));
}

export async function approvePreview(clientId: number): Promise<AstroSitePreviewStatusView> {
  const job = await astroSitePreviewStore.getLatest(clientId);
  if (!job) throw new Error("Website preview job not found.");
  if (job.status !== "ready" || !job.commitSha) {
    throw new Error("Approve a ready preview before publishing production.");
  }
  const approved = await astroSitePreviewStore.approve({
    jobId: job.id,
    approvedSha: job.commitSha,
    now: new Date(),
  });
  if (!approved) throw new Error("Preview could not be approved.");
  return toAstroSitePreviewStatus(approved, await currentRevision(clientId));
}
