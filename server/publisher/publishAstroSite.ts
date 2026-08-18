import { randomUUID } from "node:crypto";
import type { AstroSitePublish } from "../../drizzle/schema";
import {
  ASTRO_SITE_APPROVED_SOURCE_SHA,
  ASTRO_SITE_MANIFEST,
} from "../../shared/astroSiteContract";
import {
  astroSitePublishProgress,
  astroSitePublishResourceNames,
  type AstroSitePublishStatusView,
  type AstroSitePublishStep,
} from "../../shared/astroSitePublish";
import { getAstroSitePublishMaterial } from "../astroConfigDb";
import { getClientById } from "../db";
import { createCloudflareApiClient } from "./cloudflareApi";
import {
  createGitHubApiClient,
  expectedWorkflowDisplayTitle,
} from "./githubApi";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
} from "./publisherEnv";
import {
  PublisherManualAttentionError,
  reconcilePublicTemplateRepository,
} from "./repositoryReconciliation";
import { renderAstroSiteWranglerToml } from "./astroSiteWranglerConfig";
import { astroSitePublishStore } from "./astroSitePublishDb";

export type AstroSitePublishJob = AstroSitePublish;

export type AstroSitePublishStepValues = Partial<
  Pick<
    AstroSitePublishJob,
    | "repositoryId"
    | "repositoryFullName"
    | "repositoryUrl"
    | "defaultBranch"
    | "d1DatabaseId"
    | "r2BucketId"
    | "r2PublicUrl"
    | "commitSha"
    | "liveUrl"
    | "dispatchRequestedAt"
    | "workflowRunId"
    | "workflowStatus"
    | "workflowCheckedAt"
    | "runtimeSecretsPatchedAt"
  >
>;

type Completion = {
  nextStep: AstroSitePublishStep;
  values: AstroSitePublishStepValues;
};

export interface AstroSitePublishStore {
  start(input: {
    clientId: number;
    externalSiteId: string;
    templateKey: string;
    templateRepo: string;
    contractVersion: number;
    resourceName: string;
    repositoryName: string;
    workerName: string;
    d1DatabaseName: string;
    r2BucketName: string;
    now: Date;
  }): Promise<AstroSitePublishJob>;
  get(clientId: number): Promise<AstroSitePublishJob | null>;
  claim(input: {
    clientId: number;
    allowFailed: boolean;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AstroSitePublishJob | null>;
  markRepositoryCreateRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<AstroSitePublishJob | null>;
  markDispatchRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<AstroSitePublishJob | null>;
  complete(input: {
    jobId: string;
    leaseToken: string;
    expectedStep: AstroSitePublishStep;
    completion: Completion;
    now: Date;
  }): Promise<AstroSitePublishJob | null>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    message: string;
    now: Date;
    resumeStep?: AstroSitePublishStep;
    values?: AstroSitePublishStepValues;
  }): Promise<AstroSitePublishJob | null>;
}

type WorkflowResult = {
  workflowRunId: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "timed_out" | "action_required" | null;
  headSha: string;
  displayTitle: string;
};

export interface AstroSitePublishExternal {
  ensureRepository(input: {
    externalSiteId: string;
    repositoryName: string;
    allowCreate: boolean;
    markCreateRequested: () => Promise<void>;
    signal: AbortSignal;
  }): Promise<Pick<AstroSitePublishJob, "repositoryId" | "repositoryFullName" | "repositoryUrl" | "defaultBranch">>;
  ensureD1Database(input: { name: string; signal: AbortSignal }): Promise<{ d1DatabaseId: string }>;
  ensureR2Bucket(input: { name: string; signal: AbortSignal }): Promise<{ r2BucketId: string; r2PublicUrl: string }>;
  commitSource(input: {
    publishJobId: string;
    repositoryFullName: string;
    defaultBranch: string;
    workerName: string;
    d1DatabaseName: string;
    d1DatabaseId: string;
    r2BucketName: string;
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
}

export type AstroSitePublishDependencies = {
  store: AstroSitePublishStore;
  external: AstroSitePublishExternal;
  loadMaterial(clientId: number): Promise<{ generatedConfig: string; runtimeSecrets: Record<string, string> }>;
  now: () => Date;
  createLeaseToken: () => string;
  leaseDurationMs: number;
  externalTimeoutMs: number;
};

type OwnerInput = { clientId: number; retryFailed?: boolean };
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

function assertWorkflow(result: { displayTitle: string; headSha: string }, job: AstroSitePublishJob): void {
  const sourceSha = requireValue(job.commitSha, "Published source commit is missing.");
  if (
    result.displayTitle !== expectedWorkflowDisplayTitle(job.id, sourceSha) ||
    result.headSha !== sourceSha
  ) {
    throw new PublisherManualAttentionError(
      "Workflow run does not match the website publish job and source commit; manual attention is required.",
    );
  }
}

export function toAstroSitePublishStatus(job: AstroSitePublishJob): AstroSitePublishStatusView {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: astroSitePublishProgress(job.step),
    error: job.lastError,
    externalSiteId: job.externalSiteId,
    repositoryName: job.repositoryName,
    workerName: job.workerName,
    repositoryUrl: job.repositoryUrl,
    liveUrl: job.liveUrl,
    dispatchRequestedAt: job.dispatchRequestedAt,
    workflowRunId: job.workflowRunId,
    workflowStatus: job.workflowStatus,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
  };
}

async function current(input: OwnerInput, store: AstroSitePublishStore) {
  const job = await store.get(input.clientId);
  if (!job) throw new Error("Website publish job not found.");
  return toAstroSitePublishStatus(job);
}

async function complete(
  input: OwnerInput,
  job: AstroSitePublishJob,
  leaseToken: string,
  completion: Completion,
  deps: AstroSitePublishDependencies,
) {
  const result = await deps.store.complete({
    jobId: job.id,
    leaseToken,
    expectedStep: job.step,
    completion,
    now: deps.now(),
  });
  return result ? toAstroSitePublishStatus(result) : current(input, deps.store);
}

async function execute(
  input: OwnerInput,
  job: AstroSitePublishJob,
  leaseToken: string,
  deps: AstroSitePublishDependencies,
): Promise<AstroSitePublishStatusView> {
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
            if (!marked) throw new Error("Website publish lease was lost.");
          },
          signal,
        }),
      );
      return complete(input, job, leaseToken, { nextStep: "ensure_d1_database", values: result }, deps);
    }
    case "ensure_d1_database": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureD1Database({ name: job.d1DatabaseName, signal }),
      );
      return complete(input, job, leaseToken, { nextStep: "ensure_r2_bucket", values: result }, deps);
    }
    case "ensure_r2_bucket": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureR2Bucket({ name: job.r2BucketName, signal }),
      );
      return complete(input, job, leaseToken, { nextStep: "commit_source", values: result }, deps);
    }
    case "commit_source": {
      const material = await deps.loadMaterial(input.clientId);
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.commitSource({
          publishJobId: job.id,
          repositoryFullName: requireValue(job.repositoryFullName, "Published repository is missing."),
          defaultBranch: requireValue(job.defaultBranch, "Published repository branch is missing."),
          workerName: job.workerName,
          d1DatabaseName: job.d1DatabaseName,
          d1DatabaseId: requireValue(job.d1DatabaseId, "D1 database is missing."),
          r2BucketName: job.r2BucketName,
          generatedConfig: material.generatedConfig,
          signal,
        }),
      );
      return complete(input, job, leaseToken, { nextStep: "dispatch_workflow", values: result }, deps);
    }
    case "dispatch_workflow": {
      const sourceSha = requireValue(job.commitSha, "Published source commit is missing.");
      if (job.dispatchRequestedAt) {
        const run = await bounded(deps.externalTimeoutMs, signal =>
          deps.external.findWorkflowRun({
            repositoryFullName: requireValue(job.repositoryFullName, "Published repository is missing."),
            publishJobId: job.id,
            sourceSha,
            afterWorkflowRunId: job.workflowRunId,
            signal,
          }),
        );
        const checkedAt = deps.now();
        if (!run) {
          if (checkedAt.getTime() - job.dispatchRequestedAt.getTime() <= RECONCILIATION_WINDOW_MS) {
            return complete(input, job, leaseToken, {
              nextStep: "dispatch_workflow",
              values: { workflowCheckedAt: checkedAt },
            }, deps);
          }
          throw new PublisherManualAttentionError(
            "Workflow dispatch cannot be correlated; automatic redispatch is disabled.",
          );
        }
        assertWorkflow(run, job);
        return complete(input, job, leaseToken, {
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
      if (!marked) return current(input, deps.store);
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.dispatchWorkflow({
          repositoryFullName: requireValue(marked.repositoryFullName, "Published repository is missing."),
          defaultBranch: requireValue(marked.defaultBranch, "Published repository branch is missing."),
          commitSha: sourceSha,
          publishJobId: marked.id,
          signal,
        }),
      );
      return complete(input, marked, leaseToken, {
        nextStep: "dispatch_workflow",
        values: { dispatchRequestedAt: requestedAt },
      }, deps);
    }
    case "monitor_workflow": {
      const run = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkflowRun({
          repositoryFullName: requireValue(job.repositoryFullName, "Published repository is missing."),
          workflowRunId: requireValue(job.workflowRunId, "Workflow run ID is missing."),
          signal,
        }),
      );
      assertWorkflow(run, job);
      const checkedAt = deps.now();
      if (run.status !== "completed") {
        return complete(input, job, leaseToken, {
          nextStep: "monitor_workflow",
          values: { workflowStatus: run.status, workflowCheckedAt: checkedAt },
        }, deps);
      }
      if (run.conclusion !== "success") {
        const failed = await deps.store.fail({
          jobId: job.id,
          leaseToken,
          message: "Deployment workflow failed. Retry to redeploy the existing website source.",
          now: checkedAt,
          resumeStep: "dispatch_workflow",
          values: {
            dispatchRequestedAt: null,
            workflowStatus: run.conclusion ?? "failure",
            workflowCheckedAt: checkedAt,
          },
        });
        return failed ? toAstroSitePublishStatus(failed) : current(input, deps.store);
      }
      return complete(input, job, leaseToken, {
        nextStep: "patch_runtime_secrets",
        values: { workflowStatus: "success", workflowCheckedAt: checkedAt },
      }, deps);
    }
    case "patch_runtime_secrets": {
      const material = await deps.loadMaterial(input.clientId);
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.patchRuntimeSecrets({
          workerName: job.workerName,
          runtimeSecrets: material.runtimeSecrets,
          r2PublicUrl: requireValue(job.r2PublicUrl, "R2 public URL is missing."),
          signal,
        }),
      );
      return complete(input, job, leaseToken, {
        nextStep: "get_live_url",
        values: { runtimeSecretsPatchedAt: deps.now() },
      }, deps);
    }
    case "get_live_url": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkersDevStatus({ workerName: job.workerName, signal }),
      );
      const url = new URL(result.liveUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev")) {
        throw new Error("A workers.dev deployment URL is required.");
      }
      return complete(input, job, leaseToken, { nextStep: "published", values: { liveUrl: result.liveUrl } }, deps);
    }
    case "published":
      return toAstroSitePublishStatus(job);
  }
}

export async function startAstroSitePublish(
  input: { clientId: number; clientShortName: string },
  deps: AstroSitePublishDependencies,
): Promise<AstroSitePublishStatusView> {
  const names = astroSitePublishResourceNames(input.clientShortName, input.clientId);
  const job = await deps.store.start({
    clientId: input.clientId,
    ...names,
    templateKey: ASTRO_SITE_MANIFEST.templateKey,
    templateRepo: ASTRO_SITE_MANIFEST.repo,
    contractVersion: ASTRO_SITE_MANIFEST.contractVersion,
    now: deps.now(),
  });
  return toAstroSitePublishStatus(job);
}

export async function advanceAstroSitePublish(
  input: OwnerInput,
  deps: AstroSitePublishDependencies,
): Promise<AstroSitePublishStatusView> {
  const now = deps.now();
  const leaseToken = deps.createLeaseToken();
  const job = await deps.store.claim({
    clientId: input.clientId,
    allowFailed: input.retryFailed === true,
    leaseToken,
    now,
    leaseUntil: new Date(now.getTime() + deps.leaseDurationMs),
  });
  if (!job) return current(input, deps.store);
  try {
    return await execute(input, job, leaseToken, deps);
  } catch (error) {
    const failed = await deps.store.fail({
      jobId: job.id,
      leaseToken,
      message: error instanceof PublisherManualAttentionError
        ? error.message
        : "Website publish step failed. Retry to resume.",
      now: deps.now(),
    });
    return failed ? toAstroSitePublishStatus(failed) : current(input, deps.store);
  }
}

function createRuntimeExternal(): AstroSitePublishExternal {
  const githubEnvironment = getGitHubPublisherEnvironment();
  const cloudflareEnvironment = getCloudflarePublisherEnvironment();
  const github = createGitHubApiClient({ token: githubEnvironment.token });
  const cloudflare = createCloudflareApiClient(cloudflareEnvironment);
  const template = splitFullName(ASTRO_SITE_MANIFEST.repo);

  return {
    async ensureRepository(input) {
      if (input.allowCreate) {
        const templateHead = await github.getBranchHeadSha({
          ...template,
          branch: ASTRO_SITE_MANIFEST.defaultBranch,
          signal: input.signal,
        });
        if (templateHead !== ASTRO_SITE_APPROVED_SOURCE_SHA) {
          throw new PublisherManualAttentionError(
            "The canonical Astro template changed after review; approve the new source before creating repositories.",
          );
        }
      }
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
    async commitSource(input) {
      const repository = splitFullName(input.repositoryFullName);
      const message = `chore: configure Astro website ${input.publishJobId}`;
      const existing = await github.findCommitByMessage({
        ...repository,
        branch: input.defaultBranch,
        message,
        signal: input.signal,
      });
      if (existing) return existing;
      const commit = await github.commitFiles({
        ...repository,
        branch: input.defaultBranch,
        message,
        files: [
          { path: ASTRO_SITE_MANIFEST.configPath, content: input.generatedConfig },
          {
            path: "wrangler.toml",
            content: renderAstroSiteWranglerToml({
              workerName: input.workerName,
              d1DatabaseName: input.d1DatabaseName,
              d1DatabaseId: input.d1DatabaseId,
              r2BucketName: input.r2BucketName,
            }),
          },
        ],
        signal: input.signal,
      });
      return { commitSha: commit.commitSha };
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
  };
}

let configuredExternal: AstroSitePublishExternal | null = null;
export function configureAstroSitePublishExternal(external: AstroSitePublishExternal): void {
  configuredExternal = external;
}

function runtimeDependencies(): AstroSitePublishDependencies {
  return {
    store: astroSitePublishStore,
    external: configuredExternal ?? createRuntimeExternal(),
    loadMaterial: getAstroSitePublishMaterial,
    now: () => new Date(),
    createLeaseToken: randomUUID,
    leaseDurationMs: 30_000,
    externalTimeoutMs: 15_000,
  };
}

export async function startPublish(clientId: number): Promise<AstroSitePublishStatusView> {
  const [client] = await Promise.all([
    getClientById(clientId),
    getAstroSitePublishMaterial(clientId),
  ]);
  if (!client) throw new Error("Client not found.");
  return startAstroSitePublish({ clientId, clientShortName: client.shortName }, runtimeDependencies());
}

export async function advancePublish(clientId: number, retryFailed = false): Promise<AstroSitePublishStatusView> {
  return advanceAstroSitePublish({ clientId, retryFailed }, runtimeDependencies());
}

export async function publishStatus(clientId: number): Promise<AstroSitePublishStatusView | null> {
  const job = await astroSitePublishStore.get(clientId);
  return job ? toAstroSitePublishStatus(job) : null;
}
