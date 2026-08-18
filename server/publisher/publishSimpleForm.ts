import { randomUUID } from "node:crypto";
import type { FunnelPublish } from "../../drizzle/schema";
import type { SimpleFormOperatorConfig } from "../../shared/simpleFormConfig";
import {
  SIMPLE_FORM_CLOUDFLARE_INFRA,
  SIMPLE_FORM_MANIFEST,
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
import {
  createGitHubApiClient,
  expectedWorkflowDisplayTitle,
} from "./githubApi";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
  getGooglePublisherEnvironment,
} from "./publisherEnv";
import { simpleFormPublishStore } from "./publishDb";
import {
  PublisherManualAttentionError,
  reconcilePublicTemplateRepository,
} from "./repositoryReconciliation";
import { renderWranglerToml } from "./wranglerConfig";
import {
  buildPublisherWorkerSecrets,
  type PublisherWorkerSecretValues,
} from "./workerSecrets";

export type FunnelPublishJob = FunnelPublish;

export type SimpleFormRuntimeSecrets = PublisherWorkerSecretValues;

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
  renewLease(input: {
    jobId: string;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<boolean>;
  markRepositoryCreateRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
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
    allowCreate: boolean;
    markCreateRequested: () => Promise<void>;
    signal: AbortSignal;
  }): Promise<{
    repositoryId: string;
    repositoryFullName: string;
    repositoryUrl: string;
    defaultBranch: string;
  }>;
  ensureKvNamespace(input: {
    title: string;
    signal: AbortSignal;
  }): Promise<{ kvNamespaceId: string }>;
  ensureD1Database(input: {
    name: string;
    signal: AbortSignal;
  }): Promise<{ d1DatabaseId: string }>;
  ensureQueues(input: {
    primary: string;
    deadLetter: string;
    signal: AbortSignal;
  }): Promise<{
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
    workflow: string;
    publishJobId: string;
    sourceSha: string;
    afterWorkflowRunId: string | null;
    signal: AbortSignal;
  }): Promise<{
    workflowRunId: string;
    status: "queued" | "in_progress" | "completed";
    conclusion:
      | "success"
      | "failure"
      | "cancelled"
      | "timed_out"
      | "action_required"
      | null;
    headSha: string;
    displayTitle: string;
  } | null>;
  getWorkflowRun(input: {
    repositoryFullName: string;
    workflowRunId: string;
    signal: AbortSignal;
  }): Promise<{
    status: "queued" | "in_progress" | "completed";
    conclusion:
      | "success"
      | "failure"
      | "cancelled"
      | "timed_out"
      | "action_required"
      | null;
    headSha: string;
    displayTitle: string;
    liveUrl?: string;
  }>;
  patchRuntimeSecrets(input: {
    workerName: string;
    runtimeSecrets: SimpleFormRuntimeSecrets;
    signal: AbortSignal;
  }): Promise<void>;
  getWorkersDevStatus(input: {
    workerName: string;
    signal: AbortSignal;
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

const WORKFLOW_DISPATCH_RECONCILIATION_WINDOW_MS = 60_000;

class PublishExternalTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishExternalTimeoutError";
  }
}

class PublishLeaseLostError extends Error {
  constructor() {
    super("Publish lease ownership was lost.");
    this.name = "PublishLeaseLostError";
  }
}

type PublishLeaseHeartbeat = {
  failure: unknown;
  stopAfterSettlement(): Promise<void>;
};

function startPublishLeaseHeartbeat(
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies,
  controller: AbortController
): PublishLeaseHeartbeat {
  const heartbeatIntervalMs = Math.max(
    1,
    Math.floor(deps.leaseDurationMs / 3)
  );
  let stopped = false;
  let failure: unknown;
  let pendingRenewal: Promise<void> | null = null;

  const loseLease = (error: unknown): void => {
    if (failure !== undefined) return;
    failure = error;
    controller.abort(error);
  };
  const scheduleRenewal = (): void => {
    if (stopped || pendingRenewal) return;
    pendingRenewal = (async () => {
      const now = deps.now();
      try {
        const renewed = await deps.store.renewLease({
          jobId: claimed.id,
          leaseToken,
          leaseUntil: new Date(now.getTime() + deps.leaseDurationMs),
          now,
        });
        if (!renewed) loseLease(new PublishLeaseLostError());
      } catch (error) {
        loseLease(error);
      }
    })().finally(() => {
      pendingRenewal = null;
    });
  };
  const heartbeat = setInterval(scheduleRenewal, heartbeatIntervalMs);

  return {
    get failure() {
      return failure;
    },
    async stopAfterSettlement() {
      clearInterval(heartbeat);
      stopped = true;
      if (pendingRenewal) await pendingRenewal;
    },
  };
}

function requirePersisted(value: string | null, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function assertExactWorkflowDisplayTitle(
  displayTitle: string,
  publishJobId: string,
  sourceSha: string,
  mismatchMessage: string
): void {
  if (
    displayTitle !== expectedWorkflowDisplayTitle(publishJobId, sourceSha)
  ) {
    throw new PublisherManualAttentionError(mismatchMessage);
  }
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
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new PublishExternalTimeoutError(`${label} timed out.`);
  const leaseHeartbeat = startPublishLeaseHeartbeat(
    claimed,
    leaseToken,
    deps,
    controller
  );
  const timeout = setTimeout(() => {
    controller.abort(timeoutError);
  }, timeoutMs);
  let outcome:
    | { ok: true; value: T }
    | {
        ok: false;
        error: unknown;
      };
  try {
    controller.signal.throwIfAborted();
    outcome = { ok: true, value: await operation(controller.signal) };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    clearTimeout(timeout);
    await leaseHeartbeat.stopAfterSettlement();
  }
  if (leaseHeartbeat.failure !== undefined) throw leaseHeartbeat.failure;
  if (!outcome.ok) {
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? timeoutError;
    }
    throw outcome.error;
  }
  controller.signal.throwIfAborted();
  return outcome.value;
}

function externalFailureMessage(error: unknown, label: string): string {
  if (error instanceof PublishExternalTimeoutError) return error.message;
  if (error instanceof PublisherManualAttentionError) return error.message;
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.ensureRepository({
        externalFunnelId: claimed.externalFunnelId,
        repositoryName: claimed.repositoryName,
        visibility: "public",
        allowCreate: claimed.repositoryCreateRequestedAt === null,
        markCreateRequested: async () => {
          const requestedAt = deps.now();
          const marked = await deps.store.markRepositoryCreateRequested({
            jobId: claimed.id,
            leaseToken,
            requestedAt,
          });
          if (!marked) throw new PublishLeaseLostError();
        },
        signal,
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

export function publisherCloudflareResourceNames(
  resourceName: string,
  funnelId: number
): {
  kvNamespaceTitle: string;
  d1DatabaseName: string;
  primaryQueueName: string;
  deadLetterQueueName: string;
} {
  const funnelSuffix = `-${funnelId}`;
  const clientResourceName = resourceName.endsWith(funnelSuffix)
    ? resourceName.slice(0, -funnelSuffix.length)
    : resourceName;
  return {
    kvNamespaceTitle: suffixedResourceName(resourceName, "-sessions"),
    d1DatabaseName: suffixedResourceName(clientResourceName, "-db"),
    primaryQueueName: suffixedResourceName(resourceName, "-retries"),
    deadLetterQueueName: suffixedResourceName(resourceName, "-dead"),
  };
}

function cloudflareResourceNames(job: FunnelPublishJob) {
  return publisherCloudflareResourceNames(job.resourceName, job.funnelId);
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.ensureKvNamespace({
        title: cloudflareResourceNames(claimed).kvNamespaceTitle,
        signal,
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.ensureD1Database({
        name: cloudflareResourceNames(claimed).d1DatabaseName,
        signal,
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.ensureQueues({
        primary: names.primaryQueueName,
        deadLetter: names.deadLetterQueueName,
        signal,
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
    claimed,
    leaseToken,
    deps,
    signal =>
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
        signal,
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
  const sourceSha = requirePersisted(
    claimed.commitSha,
    "Published source commit is missing."
  );
  if (claimed.dispatchRequestedAt) {
    const reconciled = await boundedExternalCall(
      "Workflow dispatch reconciliation",
      deps.externalTimeoutMs,
      claimed,
      leaseToken,
      deps,
      signal =>
        deps.external.findWorkflowRun({
          repositoryFullName: requirePersisted(
            claimed.repositoryFullName,
            "Published repository is missing."
          ),
          workflow: "deploy.yml",
          publishJobId: claimed.id,
          sourceSha,
          afterWorkflowRunId: claimed.workflowRunId,
          signal,
        })
    );
    const checkedAt = deps.now();
    if (!reconciled) {
      if (
        checkedAt.getTime() - claimed.dispatchRequestedAt.getTime() <=
        WORKFLOW_DISPATCH_RECONCILIATION_WINDOW_MS
      ) {
        return completeStep(
          input,
          claimed,
          leaseToken,
          {
            nextStep: "dispatch_workflow",
            values: { workflowCheckedAt: checkedAt },
          },
          deps
        );
      }
      throw new PublisherManualAttentionError(
        "Workflow dispatch outcome cannot be correlated within the reconciliation window; manual attention is required and automatic redispatch is disabled."
      );
    }
    assertExactWorkflowDisplayTitle(
      reconciled.displayTitle,
      claimed.id,
      sourceSha,
      "Workflow dispatch outcome cannot be correlated exactly; manual attention is required and automatic redispatch is disabled."
    );
    return completeStep(
      input,
      claimed,
      leaseToken,
      {
        nextStep: "monitor_workflow",
        values: {
          workflowRunId: reconciled.workflowRunId,
          workflowStatus: reconciled.status,
          workflowCheckedAt: checkedAt,
        },
      },
      deps
    );
  }

  const requestedAt = deps.now();
  const marked = await deps.store.markDispatchRequested({
    jobId: claimed.id,
    leaseToken,
    requestedAt,
  });
  if (!marked) return currentStatus(input, deps.store);

  await boundedExternalCall(
    "Workflow dispatch",
    deps.externalTimeoutMs,
    marked,
    leaseToken,
    deps,
    signal =>
      deps.external.dispatchWorkflow({
        repositoryFullName: requirePersisted(
          marked.repositoryFullName,
          "Published repository is missing."
        ),
        defaultBranch: requirePersisted(
          marked.defaultBranch,
          "Published repository branch is missing."
        ),
        commitSha: sourceSha,
        publishJobId: marked.id,
        signal,
      })
  );
  return completeStep(
    input,
    marked,
    leaseToken,
    {
      nextStep: "dispatch_workflow",
      values: {
        dispatchRequestedAt: requestedAt,
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.getWorkflowRun({
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        workflowRunId: requirePersisted(
          claimed.workflowRunId,
          "Workflow run ID is missing."
        ),
        signal,
      })
  );
  const expectedSourceSha = requirePersisted(
    claimed.commitSha,
    "Published source commit is missing."
  );
  assertExactWorkflowDisplayTitle(
    result.displayTitle,
    claimed.id,
    expectedSourceSha,
    "Workflow run correlation or source does not match the publish job; manual attention is required."
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
      message:
        "Deployment workflow failed. Retry to redeploy the existing published source.",
      now: checkedAt,
      resumeStep: "dispatch_workflow",
      values: {
        dispatchRequestedAt: null,
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.patchRuntimeSecrets({
        workerName: claimed.workerName,
        runtimeSecrets: material.runtimeSecrets,
        signal,
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
    claimed,
    leaseToken,
    deps,
    signal =>
      deps.external.getWorkersDevStatus({
        workerName: claimed.workerName,
        signal,
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
  const github = createGitHubApiClient({
    token: githubEnvironment.token,
  });
  const cloudflare = createCloudflareApiClient({
    accountId: cloudflareEnvironment.accountId,
    apiToken: cloudflareEnvironment.apiToken,
  });

  return {
    async ensureRepository(input) {
      const template = templateRepository();
      const repository = await reconcilePublicTemplateRepository({
        github,
        owner: githubEnvironment.owner,
        repository: input.repositoryName,
        templateOwner: template.owner,
        templateRepository: template.repository,
        description: `Generated Simple Form funnel ${input.externalFunnelId}`,
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
    async ensureKvNamespace(input) {
      const namespace = await cloudflare.ensureKvNamespace(
        input.title,
        input.signal
      );
      return { kvNamespaceId: namespace.id };
    },
    async ensureD1Database(input) {
      const database = await cloudflare.ensureD1Database(
        input.name,
        input.signal
      );
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
        signal: input.signal,
      });
      return { commitSha: commit.commitSha };
    },
    async dispatchWorkflow(input) {
      const repository = splitRepositoryFullName(input.repositoryFullName);
      await github.dispatchWorkflow({
        owner: repository.owner,
        repository: repository.repository,
        workflow: "deploy.yml",
        ref: input.defaultBranch,
        publishJobId: input.publishJobId,
        sourceSha: input.commitSha,
        signal: input.signal,
      });
    },
    async findWorkflowRun(input) {
      const repository = splitRepositoryFullName(input.repositoryFullName);
      const afterWorkflowRunId = input.afterWorkflowRunId
        ? Number(input.afterWorkflowRunId)
        : undefined;
      if (
        afterWorkflowRunId !== undefined &&
        (!Number.isSafeInteger(afterWorkflowRunId) || afterWorkflowRunId <= 0)
      ) {
        throw new Error("Previous workflow run ID is invalid.");
      }
      const run = await github.findWorkflowRun({
        owner: repository.owner,
        repository: repository.repository,
        workflow: input.workflow,
        publishJobId: input.publishJobId,
        sourceSha: input.sourceSha,
        afterWorkflowRunId,
        signal: input.signal,
      });
      return run
        ? {
            workflowRunId: String(run.id),
            status: run.status,
            conclusion: run.conclusion,
            headSha: run.headSha,
            displayTitle: run.displayTitle,
          }
        : null;
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
        signal: input.signal,
      });
    },
    async patchRuntimeSecrets(input) {
      const secrets = buildPublisherWorkerSecrets(
        input.runtimeSecrets,
        getGooglePublisherEnvironment()
      );
      await cloudflare.patchWorkerSecrets({
        scriptName: input.workerName,
        secrets,
        signal: input.signal,
      });
    },
    async getWorkersDevStatus(input) {
      const status = await cloudflare.getWorkersDevStatus({
        scriptName: input.workerName,
        signal: input.signal,
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
    loadMaterial: async input => {
      const material = await getSimpleFormPublishMaterial(input);
      return {
        config: material.config,
        runtimeSecrets:
          material.runtimeSecrets as unknown as PublisherWorkerSecretValues,
      };
    },
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
