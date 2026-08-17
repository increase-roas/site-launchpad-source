import { randomUUID } from "node:crypto";
import type { FunnelPublish } from "../../drizzle/schema";
import type { SimpleFormOperatorConfig } from "../../shared/simpleFormConfig";
import {
  SIMPLE_FORM_CLOUDFLARE_INFRA,
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_RUNTIME_SECRET_KEYS,
  type SimpleFormRuntimeSecretKey,
} from "../../shared/simpleFormContract";
import {
  simpleFormPublishProgress,
  simpleFormPublishResourceNames,
  type FunnelPublishStatus,
  type FunnelPublishStep,
  type SimpleFormPublishStatusView,
} from "../../shared/simpleFormPublish";
import {
  getSimpleFormPublishHandoff,
  getSimpleFormPublishMaterial,
} from "../simpleFormDb";
import { createCloudflareApiClient } from "./cloudflareApi";
import { renderFunnelConfigTs } from "./funnelConfigFile";
import { createGitHubApiClient } from "./githubApi";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
} from "./publisherEnv";
import { simpleFormPublishStore } from "./publishDb";
import { renderWranglerToml } from "./wranglerConfig";

export type FunnelPublishJob = FunnelPublish;

export type SimpleFormRuntimeSecrets = Record<
  SimpleFormRuntimeSecretKey,
  string | null
>;

export type SimpleFormPublishMaterial = {
  config: SimpleFormOperatorConfig;
  runtimeSecrets: SimpleFormRuntimeSecrets;
};

export type PublishStepValues = Partial<
  Pick<
    FunnelPublishJob,
    | "repositoryId"
    | "repositoryFullName"
    | "repositoryUrl"
    | "defaultBranch"
    | "kvNamespaceId"
    | "d1DatabaseId"
    | "primaryQueueId"
    | "deadLetterQueueId"
    | "commitSha"
    | "liveUrl"
    | "dispatchRequestedAt"
    | "workflowRunId"
    | "workflowStatus"
    | "workflowCheckedAt"
    | "runtimeSecretsPatchedAt"
  >
>;

export type PublishStepCompletion = {
  nextStep: FunnelPublishStep;
  values: PublishStepValues;
};

export interface SimpleFormPublishStore {
  start(input: {
    clientId: number;
    funnelId: number;
    externalFunnelId: string;
    resourceName: string;
    repositoryName: string;
    workerName: string;
    now: Date;
  }): Promise<FunnelPublishJob>;
  get(clientId: number, funnelId: number): Promise<FunnelPublishJob | null>;
  claim(input: {
    clientId: number;
    funnelId: number;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<FunnelPublishJob | null>;
  markDispatchRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<FunnelPublishJob | null>;
  complete(input: {
    jobId: string;
    leaseToken: string;
    expectedStep: FunnelPublishStep;
    completion: PublishStepCompletion;
    now: Date;
  }): Promise<FunnelPublishJob | null>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    message: string;
    now: Date;
    resumeStep?: FunnelPublishStep;
    values?: PublishStepValues;
  }): Promise<FunnelPublishJob | null>;
}

export interface SimpleFormPublishExternal {
  ensureRepository(input: {
    externalFunnelId: string;
    repositoryName: string;
    visibility: "public";
  }): Promise<{
    repositoryId: string;
    repositoryFullName: string;
    repositoryUrl: string;
    defaultBranch: string;
  }>;
  ensureKvNamespace(input: {
    title: string;
  }): Promise<{ kvNamespaceId: string }>;
  ensureD1Database(input: { name: string }): Promise<{ d1DatabaseId: string }>;
  ensureQueues(input: { primary: string; deadLetter: string }): Promise<{
    primaryQueueId: string;
    deadLetterQueueId: string;
  }>;
  commitSource(input: {
    externalFunnelId: string;
    repositoryFullName: string;
    defaultBranch: string;
    config: SimpleFormOperatorConfig;
    workerName: string;
    kvNamespaceId: string;
    d1DatabaseName: string;
    d1DatabaseId: string;
    primaryQueueName: string;
    deadLetterQueueName: string;
    idempotencyKey: string;
  }): Promise<{ commitSha: string }>;
  dispatchWorkflow(input: {
    externalFunnelId: string;
    repositoryFullName: string;
    defaultBranch: string;
    commitSha: string;
    workerName: string;
    idempotencyKey: string;
  }): Promise<{ workflowRunId: string; status: "queued" }>;
  getWorkflowRun(input: {
    repositoryFullName: string;
    workflowRunId: string;
  }): Promise<{
    status: "queued" | "in_progress" | "completed";
    conclusion:
      | "success"
      | "failure"
      | "cancelled"
      | "timed_out"
      | "action_required"
      | null;
    liveUrl?: string;
  }>;
  patchRuntimeSecrets(input: {
    workerName: string;
    runtimeSecrets: SimpleFormRuntimeSecrets;
  }): Promise<void>;
  getWorkersDevStatus(input: {
    workerName: string;
  }): Promise<{ liveUrl: string }>;
}

export type SimpleFormPublishDependencies = {
  store: SimpleFormPublishStore;
  external: SimpleFormPublishExternal;
  loadMaterial(input: {
    clientId: number;
    funnelId: number;
  }): Promise<SimpleFormPublishMaterial>;
  now: () => Date;
  createLeaseToken: () => string;
  leaseDurationMs: number;
  externalTimeoutMs: number;
  repositoryGenerationTimeoutMs: number;
};

type PublishOwnerInput = {
  clientId: number;
  funnelId: number;
};

type StartPublishInput = PublishOwnerInput & {
  clientShortName: string;
};

class PublishExternalTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishExternalTimeoutError";
  }
}

function requirePersisted(value: string | null, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function requireWorkersDevUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname.toLowerCase().endsWith(".workers.dev")
  ) {
    throw new Error("A workers.dev deployment URL is required.");
  }
  return value;
}

async function boundedExternalCall<T>(
  label: string,
  timeoutMs: number,
  operation: () => Promise<T>
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new PublishExternalTimeoutError(`${label} timed out.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function externalFailureMessage(error: unknown, label: string): string {
  if (error instanceof PublishExternalTimeoutError) return error.message;
  return `${label} failed. Retry to resume.`;
}

export function toSimpleFormPublishStatus(
  job: FunnelPublishJob
): SimpleFormPublishStatusView {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: simpleFormPublishProgress(job.step),
    error: job.lastError,
    externalFunnelId: job.externalFunnelId,
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

async function currentStatus(
  input: PublishOwnerInput,
  store: SimpleFormPublishStore
): Promise<SimpleFormPublishStatusView> {
  const job = await store.get(input.clientId, input.funnelId);
  if (!job) throw new Error("Publish job not found.");
  return toSimpleFormPublishStatus(job);
}

async function completeStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  completion: PublishStepCompletion,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const completed = await deps.store.complete({
    jobId: claimed.id,
    leaseToken,
    expectedStep: claimed.step,
    completion,
    now: deps.now(),
  });
  return completed
    ? toSimpleFormPublishStatus(completed)
    : currentStatus(input, deps.store);
}

async function runRepositoryStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const result = await boundedExternalCall(
    "Repository creation",
    deps.repositoryGenerationTimeoutMs,
    () =>
      deps.external.ensureRepository({
        externalFunnelId: claimed.externalFunnelId,
        repositoryName: claimed.repositoryName,
        visibility: "public",
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "ensure_kv_namespace",
      values: result,
    },
    deps
  );
}

const CLOUDFLARE_RESOURCE_NAME_MAX_LENGTH = 63;

function suffixedResourceName(base: string, suffix: string): string {
  const prefix = base
    .slice(0, CLOUDFLARE_RESOURCE_NAME_MAX_LENGTH - suffix.length)
    .replace(/-+$/g, "");
  return `${prefix}${suffix}`;
}

function cloudflareResourceNames(job: FunnelPublishJob): {
  kvNamespaceTitle: string;
  d1DatabaseName: string;
  primaryQueueName: string;
  deadLetterQueueName: string;
} {
  return {
    kvNamespaceTitle: suffixedResourceName(job.resourceName, "-sessions"),
    d1DatabaseName: suffixedResourceName(job.resourceName, "-db"),
    primaryQueueName: suffixedResourceName(job.resourceName, "-retries"),
    deadLetterQueueName: suffixedResourceName(job.resourceName, "-dead"),
  };
}

async function runKvNamespaceStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const result = await boundedExternalCall(
    "KV namespace configuration",
    deps.externalTimeoutMs,
    () =>
      deps.external.ensureKvNamespace({
        title: cloudflareResourceNames(claimed).kvNamespaceTitle,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "ensure_d1_database",
      values: result,
    },
    deps
  );
}

async function runD1DatabaseStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const result = await boundedExternalCall(
    "D1 database configuration",
    deps.externalTimeoutMs,
    () =>
      deps.external.ensureD1Database({
        name: cloudflareResourceNames(claimed).d1DatabaseName,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "ensure_queues",
      values: result,
    },
    deps
  );
}

async function runQueuesStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const names = cloudflareResourceNames(claimed);
  const result = await boundedExternalCall(
    "Queue configuration",
    deps.externalTimeoutMs,
    () =>
      deps.external.ensureQueues({
        primary: names.primaryQueueName,
        deadLetter: names.deadLetterQueueName,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "commit_source",
      values: result,
    },
    deps
  );
}

async function runSourceStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const material = await deps.loadMaterial(input);
  const names = cloudflareResourceNames(claimed);
  const result = await boundedExternalCall(
    "Source commit",
    deps.externalTimeoutMs,
    () =>
      deps.external.commitSource({
        externalFunnelId: claimed.externalFunnelId,
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        defaultBranch: requirePersisted(
          claimed.defaultBranch,
          "Published repository branch is missing."
        ),
        config: material.config,
        workerName: claimed.workerName,
        kvNamespaceId: requirePersisted(
          claimed.kvNamespaceId,
          "KV namespace is missing."
        ),
        d1DatabaseName: names.d1DatabaseName,
        d1DatabaseId: requirePersisted(
          claimed.d1DatabaseId,
          "D1 database is missing."
        ),
        primaryQueueName: names.primaryQueueName,
        deadLetterQueueName: names.deadLetterQueueName,
        idempotencyKey: `${claimed.id}:source`,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "dispatch_workflow",
      values: result,
    },
    deps
  );
}

async function runDispatchStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const requestedAt = deps.now();
  const marked = await deps.store.markDispatchRequested({
    jobId: claimed.id,
    leaseToken,
    requestedAt,
  });
  if (!marked) return currentStatus(input, deps.store);

  const result = await boundedExternalCall(
    "Workflow dispatch",
    deps.externalTimeoutMs,
    () =>
      deps.external.dispatchWorkflow({
        externalFunnelId: marked.externalFunnelId,
        repositoryFullName: requirePersisted(
          marked.repositoryFullName,
          "Published repository is missing."
        ),
        defaultBranch: requirePersisted(
          marked.defaultBranch,
          "Published repository branch is missing."
        ),
        commitSha: requirePersisted(
          marked.commitSha,
          "Published source commit is missing."
        ),
        workerName: marked.workerName,
        idempotencyKey: `${marked.id}:${marked.attemptCount}`,
      })
  );
  return completeStep(
    input,
    marked,
    leaseToken,
    {
      nextStep: "monitor_workflow",
      values: {
        dispatchRequestedAt: requestedAt,
        workflowRunId: result.workflowRunId,
        workflowStatus: result.status,
      },
    },
    deps
  );
}

async function runMonitorWorkflowStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const checkedAt = deps.now();
  const result = await boundedExternalCall(
    "Workflow status check",
    deps.externalTimeoutMs,
    () =>
      deps.external.getWorkflowRun({
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        workflowRunId: requirePersisted(
          claimed.workflowRunId,
          "Workflow run ID is missing."
        ),
      })
  );
  if (result.status !== "completed") {
    return completeStep(
      input,
      claimed,
      leaseToken,
      {
        nextStep: "monitor_workflow",
        values: {
          workflowStatus: result.status,
          workflowCheckedAt: checkedAt,
        },
      },
      deps
    );
  }
  if (result.conclusion !== "success") {
    const failed = await deps.store.fail({
      jobId: claimed.id,
      leaseToken,
      message: "Deployment workflow failed. Retry to dispatch a new run.",
      now: checkedAt,
      resumeStep: "dispatch_workflow",
      values: {
        dispatchRequestedAt: null,
        workflowRunId: null,
        workflowStatus: result.conclusion ?? "failure",
        workflowCheckedAt: checkedAt,
      },
    });
    return failed
      ? toSimpleFormPublishStatus(failed)
      : currentStatus(input, deps.store);
  }
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "patch_runtime_secrets",
      values: {
        workflowStatus: "success",
        workflowCheckedAt: checkedAt,
      },
    },
    deps
  );
}

async function runPatchRuntimeSecretsStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const material = await deps.loadMaterial(input);
  await boundedExternalCall(
    "Runtime secret configuration",
    deps.externalTimeoutMs,
    () =>
      deps.external.patchRuntimeSecrets({
        workerName: claimed.workerName,
        runtimeSecrets: material.runtimeSecrets,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "get_live_url",
      values: { runtimeSecretsPatchedAt: deps.now() },
    },
    deps
  );
}

async function runGetLiveUrlStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const result = await boundedExternalCall(
    "workers.dev status lookup",
    deps.externalTimeoutMs,
    () =>
      deps.external.getWorkersDevStatus({
        workerName: claimed.workerName,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "published",
      values: { liveUrl: requireWorkersDevUrl(result.liveUrl) },
    },
    deps
  );
}

async function executeClaimedStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  switch (claimed.step) {
    case "create_repository":
      return runRepositoryStep(input, claimed, leaseToken, deps);
    case "ensure_kv_namespace":
      return runKvNamespaceStep(input, claimed, leaseToken, deps);
    case "ensure_d1_database":
      return runD1DatabaseStep(input, claimed, leaseToken, deps);
    case "ensure_queues":
      return runQueuesStep(input, claimed, leaseToken, deps);
    case "commit_source":
      return runSourceStep(input, claimed, leaseToken, deps);
    case "dispatch_workflow":
      return runDispatchStep(input, claimed, leaseToken, deps);
    case "monitor_workflow":
      return runMonitorWorkflowStep(input, claimed, leaseToken, deps);
    case "patch_runtime_secrets":
      return runPatchRuntimeSecretsStep(input, claimed, leaseToken, deps);
    case "get_live_url":
      return runGetLiveUrlStep(input, claimed, leaseToken, deps);
    case "published":
      return toSimpleFormPublishStatus(claimed);
    default: {
      const exhaustive: never = claimed.step;
      throw new Error(`Unsupported publish step: ${exhaustive}`);
    }
  }
}

function stepLabel(step: FunnelPublishStep): string {
  switch (step) {
    case "create_repository":
      return "Repository creation";
    case "ensure_kv_namespace":
      return "KV namespace configuration";
    case "ensure_d1_database":
      return "D1 database configuration";
    case "ensure_queues":
      return "Queue configuration";
    case "commit_source":
      return "Source commit";
    case "dispatch_workflow":
      return "Workflow dispatch";
    case "monitor_workflow":
      return "Workflow status check";
    case "patch_runtime_secrets":
      return "Runtime secret configuration";
    case "get_live_url":
      return "workers.dev status lookup";
    case "published":
      return "Publishing";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export async function startSimpleFormPublish(
  input: StartPublishInput,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const names = simpleFormPublishResourceNames(
    input.clientShortName,
    input.funnelId
  );
  const job = await deps.store.start({
    clientId: input.clientId,
    funnelId: input.funnelId,
    ...names,
    now: deps.now(),
  });
  return toSimpleFormPublishStatus(job);
}

export async function advanceSimpleFormPublish(
  input: PublishOwnerInput,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const now = deps.now();
  const leaseToken = deps.createLeaseToken();
  const claimed = await deps.store.claim({
    ...input,
    leaseToken,
    now,
    leaseUntil: new Date(now.getTime() + deps.leaseDurationMs),
  });
  if (!claimed) return currentStatus(input, deps.store);

  try {
    return await executeClaimedStep(input, claimed, leaseToken, deps);
  } catch (error) {
    const failed = await deps.store.fail({
      jobId: claimed.id,
      leaseToken,
      message: externalFailureMessage(error, stepLabel(claimed.step)),
      now: deps.now(),
    });
    return failed
      ? toSimpleFormPublishStatus(failed)
      : currentStatus(input, deps.store);
  }
}

function splitRepositoryFullName(fullName: string): {
  owner: string;
  repository: string;
} {
  const segments = fullName.split("/");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("Published repository name is invalid.");
  }
  return { owner: segments[0], repository: segments[1] };
}

function templateRepository(): { owner: string; repository: string } {
  return splitRepositoryFullName(SIMPLE_FORM_MANIFEST.repo);
}

function createRuntimeExternal(): SimpleFormPublishExternal {
  const githubEnvironment = getGitHubPublisherEnvironment();
  const cloudflareEnvironment = getCloudflarePublisherEnvironment();
  const github = createGitHubApiClient({ token: githubEnvironment.token });
  const cloudflare = createCloudflareApiClient({
    accountId: cloudflareEnvironment.accountId,
    apiToken: cloudflareEnvironment.apiToken,
  });

  return {
    async ensureRepository(input) {
      const template = templateRepository();
      const repository = await github.generatePublicRepository({
        templateOwner: template.owner,
        templateRepository: template.repository,
        owner: githubEnvironment.owner,
        repository: input.repositoryName,
        description: `Generated Simple Form funnel ${input.externalFunnelId}`,
      });
      return {
        repositoryId: String(repository.id),
        repositoryFullName: repository.fullName,
        repositoryUrl: repository.htmlUrl,
        defaultBranch: repository.defaultBranch,
      };
    },
    async ensureKvNamespace(input) {
      const namespace = await cloudflare.ensureKvNamespace(input.title);
      return { kvNamespaceId: namespace.id };
    },
    async ensureD1Database(input) {
      const database = await cloudflare.ensureD1Database(input.name);
      return { d1DatabaseId: database.id };
    },
    async ensureQueues(input) {
      const queues = await cloudflare.ensureQueues(input);
      return {
        primaryQueueId: queues.primary.id,
        deadLetterQueueId: queues.deadLetter.id,
      };
    },
    async commitSource(input) {
      const repository = splitRepositoryFullName(input.repositoryFullName);
      const commit = await github.commitPublisherFiles({
        owner: repository.owner,
        repository: repository.repository,
        branch: input.defaultBranch,
        message: "chore: configure generated Simple Form funnel",
        files: {
          wranglerToml: renderWranglerToml({
            workerName: input.workerName,
            compatibilityDate: "2026-08-11",
            environment: SIMPLE_FORM_CLOUDFLARE_INFRA.vars.ENVIRONMENT,
            metaGraphApiVersion:
              SIMPLE_FORM_CLOUDFLARE_INFRA.vars.META_GRAPH_API_VERSION,
            kvNamespaceId: input.kvNamespaceId,
            d1DatabaseName: input.d1DatabaseName,
            d1DatabaseId: input.d1DatabaseId,
            primaryQueueName: input.primaryQueueName,
            deadLetterQueueName: input.deadLetterQueueName,
          }),
          funnelConfigTs: renderFunnelConfigTs(input.config),
        },
      });
      return { commitSha: commit.commitSha };
    },
    async dispatchWorkflow(input) {
      const repository = splitRepositoryFullName(input.repositoryFullName);
      const dispatched = await github.dispatchWorkflow({
        owner: repository.owner,
        repository: repository.repository,
        workflow: "deploy.yml",
        ref: input.defaultBranch,
      });
      return {
        workflowRunId: String(dispatched.workflow_run_id),
        status: "queued",
      };
    },
    async getWorkflowRun(input) {
      const repository = splitRepositoryFullName(input.repositoryFullName);
      const workflowRunId = Number(input.workflowRunId);
      if (!Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
        throw new Error("Workflow run ID is invalid.");
      }
      return github.getWorkflowRun({
        owner: repository.owner,
        repository: repository.repository,
        workflowRunId,
      });
    },
    async patchRuntimeSecrets(input) {
      const secrets = SIMPLE_FORM_RUNTIME_SECRET_KEYS.flatMap(name => {
        const value = input.runtimeSecrets[name];
        return value ? [{ name, value }] : [];
      });
      await cloudflare.patchWorkerSecrets({
        scriptName: input.workerName,
        secrets,
      });
    },
    async getWorkersDevStatus(input) {
      const status = await cloudflare.getWorkersDevStatus({
        scriptName: input.workerName,
      });
      if (!status.enabled || !status.url) {
        throw new Error("workers.dev is not enabled for the published Worker.");
      }
      return { liveUrl: status.url };
    },
  };
}

let configuredExternal: SimpleFormPublishExternal | null = null;

export function configureSimpleFormPublishExternal(
  external: SimpleFormPublishExternal
): void {
  configuredExternal = external;
}

function runtimeDependencies(): SimpleFormPublishDependencies {
  return {
    store: simpleFormPublishStore,
    external: configuredExternal ?? createRuntimeExternal(),
    loadMaterial: getSimpleFormPublishMaterial,
    now: () => new Date(),
    createLeaseToken: randomUUID,
    leaseDurationMs: 30_000,
    externalTimeoutMs: 10_000,
    repositoryGenerationTimeoutMs: 15_000,
  };
}

export async function startPublish(
  clientId: number,
  funnelId: number
): Promise<SimpleFormPublishStatusView> {
  const handoff = await getSimpleFormPublishHandoff(clientId, funnelId);
  if (!handoff.configurationReady) {
    throw new Error("Complete Simple Form readiness before publishing.");
  }
  return startSimpleFormPublish(
    {
      clientId,
      funnelId,
      clientShortName: handoff.client.shortName,
    },
    runtimeDependencies()
  );
}

export async function advancePublish(
  clientId: number,
  funnelId: number
): Promise<SimpleFormPublishStatusView> {
  return advanceSimpleFormPublish(
    { clientId, funnelId },
    runtimeDependencies()
  );
}

export async function publishStatus(
  clientId: number,
  funnelId: number
): Promise<SimpleFormPublishStatusView | null> {
  const job = await simpleFormPublishStore.get(clientId, funnelId);
  return job ? toSimpleFormPublishStatus(job) : null;
}
