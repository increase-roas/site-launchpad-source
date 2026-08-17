import { randomUUID } from "node:crypto";
import type { FunnelPublish } from "../../drizzle/schema";
import type { SimpleFormOperatorConfig } from "../../shared/simpleFormConfig";
import type { SimpleFormRuntimeSecretKey } from "../../shared/simpleFormContract";
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
import { simpleFormPublishStore } from "./publishDb";

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
    | "commitSha"
    | "liveUrl"
    | "dispatchRequestedAt"
    | "workflowRunId"
    | "workflowStatus"
    | "workflowCheckedAt"
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
  commitSource(input: {
    externalFunnelId: string;
    repositoryFullName: string;
    defaultBranch: string;
    config: SimpleFormOperatorConfig;
    idempotencyKey: string;
  }): Promise<{ commitSha: string }>;
  ensureCloudflare(input: {
    externalFunnelId: string;
    workerName: string;
    repositoryFullName: string;
    runtimeSecrets: SimpleFormRuntimeSecrets;
  }): Promise<{ liveUrl: string }>;
  dispatchWorkflow(input: {
    externalFunnelId: string;
    repositoryFullName: string;
    defaultBranch: string;
    commitSha: string;
    workerName: string;
    idempotencyKey: string;
  }): Promise<void>;
  findWorkflowRun(input: {
    externalFunnelId: string;
    repositoryFullName: string;
    dispatchRequestedAt: Date;
  }): Promise<{
    workflowRunId: string | null;
    status: string | null;
  }>;
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
    deps.externalTimeoutMs,
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
        idempotencyKey: `${claimed.id}:source`,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "configure_cloudflare",
      values: result,
    },
    deps
  );
}

async function runCloudflareStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const material = await deps.loadMaterial(input);
  const result = await boundedExternalCall(
    "Cloudflare configuration",
    deps.externalTimeoutMs,
    () =>
      deps.external.ensureCloudflare({
        externalFunnelId: claimed.externalFunnelId,
        workerName: claimed.workerName,
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        runtimeSecrets: material.runtimeSecrets,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: "dispatch_workflow",
      values: { liveUrl: requireWorkersDevUrl(result.liveUrl) },
    },
    deps
  );
}

async function recoverUncertainDispatch(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const checkedAt = deps.now();
  const result = await boundedExternalCall(
    "Workflow lookup",
    deps.externalTimeoutMs,
    () =>
      deps.external.findWorkflowRun({
        externalFunnelId: claimed.externalFunnelId,
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        dispatchRequestedAt: claimed.dispatchRequestedAt as Date,
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    result.workflowRunId
      ? {
          nextStep: "monitor_workflow",
          values: {
            workflowRunId: result.workflowRunId,
            workflowStatus: result.status,
            workflowCheckedAt: checkedAt,
          },
        }
      : {
          nextStep: "dispatch_workflow",
          values: {
            dispatchRequestedAt: null,
            workflowStatus: "dispatch_not_found",
            workflowCheckedAt: checkedAt,
          },
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
  if (claimed.dispatchRequestedAt) {
    return recoverUncertainDispatch(input, claimed, leaseToken, deps);
  }

  const requestedAt = deps.now();
  const marked = await deps.store.markDispatchRequested({
    jobId: claimed.id,
    leaseToken,
    requestedAt,
  });
  if (!marked) return currentStatus(input, deps.store);

  await boundedExternalCall("Workflow dispatch", deps.externalTimeoutMs, () =>
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
      nextStep: "locate_workflow",
      values: {
        dispatchRequestedAt: requestedAt,
        workflowStatus: "dispatched",
      },
    },
    deps
  );
}

async function runLocateWorkflowStep(
  input: PublishOwnerInput,
  claimed: FunnelPublishJob,
  leaseToken: string,
  deps: SimpleFormPublishDependencies
): Promise<SimpleFormPublishStatusView> {
  const checkedAt = deps.now();
  const result = await boundedExternalCall(
    "Workflow lookup",
    deps.externalTimeoutMs,
    () =>
      deps.external.findWorkflowRun({
        externalFunnelId: claimed.externalFunnelId,
        repositoryFullName: requirePersisted(
          claimed.repositoryFullName,
          "Published repository is missing."
        ),
        dispatchRequestedAt:
          claimed.dispatchRequestedAt ??
          (() => {
            throw new Error("Workflow dispatch timestamp is missing.");
          })(),
      })
  );
  return completeStep(
    input,
    claimed,
    leaseToken,
    {
      nextStep: result.workflowRunId ? "monitor_workflow" : "locate_workflow",
      values: {
        workflowRunId: result.workflowRunId,
        workflowStatus: result.status ?? "awaiting_run",
        workflowCheckedAt: checkedAt,
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
      nextStep: "published",
      values: {
        workflowStatus: "success",
        workflowCheckedAt: checkedAt,
        liveUrl: result.liveUrl
          ? requireWorkersDevUrl(result.liveUrl)
          : claimed.liveUrl,
      },
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
    case "commit_source":
      return runSourceStep(input, claimed, leaseToken, deps);
    case "configure_cloudflare":
      return runCloudflareStep(input, claimed, leaseToken, deps);
    case "dispatch_workflow":
      return runDispatchStep(input, claimed, leaseToken, deps);
    case "locate_workflow":
      return runLocateWorkflowStep(input, claimed, leaseToken, deps);
    case "monitor_workflow":
      return runMonitorWorkflowStep(input, claimed, leaseToken, deps);
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
    case "commit_source":
      return "Source commit";
    case "configure_cloudflare":
      return "Cloudflare configuration";
    case "dispatch_workflow":
      return "Workflow dispatch";
    case "locate_workflow":
      return "Workflow lookup";
    case "monitor_workflow":
      return "Workflow status check";
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

const unavailableExternal: SimpleFormPublishExternal = {
  ensureRepository: async () => {
    throw new Error("Publisher integration is not configured.");
  },
  commitSource: async () => {
    throw new Error("Publisher integration is not configured.");
  },
  ensureCloudflare: async () => {
    throw new Error("Publisher integration is not configured.");
  },
  dispatchWorkflow: async () => {
    throw new Error("Publisher integration is not configured.");
  },
  findWorkflowRun: async () => {
    throw new Error("Publisher integration is not configured.");
  },
  getWorkflowRun: async () => {
    throw new Error("Publisher integration is not configured.");
  },
};

let configuredExternal: SimpleFormPublishExternal = unavailableExternal;

export function configureSimpleFormPublishExternal(
  external: SimpleFormPublishExternal
): void {
  configuredExternal = external;
}

function runtimeDependencies(): SimpleFormPublishDependencies {
  return {
    store: simpleFormPublishStore,
    external: configuredExternal,
    loadMaterial: getSimpleFormPublishMaterial,
    now: () => new Date(),
    createLeaseToken: randomUUID,
    leaseDurationMs: 30_000,
    externalTimeoutMs: 20_000,
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
