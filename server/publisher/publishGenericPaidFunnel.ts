import { randomUUID } from "node:crypto";
import type { GenericPaidFunnelPublish } from "../../drizzle/schema";
import {
  genericPaidFunnelPublishProgress,
  genericPaidFunnelResourceNames,
  type GenericPaidFunnelProvisionedResources,
  type GenericPaidFunnelPublishStatusView,
  type GenericPaidFunnelPublishStep,
  type GenericPaidFunnelResourceDefinitions,
} from "../../shared/genericPaidFunnelPublish";
import { decryptSetupValue, encryptSetupValue } from "../clientSecurity";
import {
  CloudflareApiError,
  createCloudflareApiClient,
} from "./cloudflareApi";
import {
  createGitHubApiClient,
  expectedWorkflowDisplayTitle,
  GitHubApiError,
  type GitHubApiClient,
} from "./githubApi";
import {
  genericPaidFunnelResourceDefinitions,
  getGenericPaidFunnelPublishMaterial,
  openGenericPaidFunnelMaterialSnapshot,
  sealGenericPaidFunnelMaterialSnapshot,
  type GenericPaidFunnelPublishMaterial,
} from "./genericPaidFunnelMaterial";
import { genericPaidFunnelPublishStore } from "./genericPaidFunnelPublishDb";
import {
  renderGenericPaidFunnelDeployWorkflow,
  renderGenericPaidFunnelWranglerToml,
} from "./genericPaidFunnelWranglerConfig";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
} from "./publisherEnv";
import {
  PublisherManualAttentionError,
  PublisherProvenNoEffectError,
  reconcilePublicGeneratedRepository,
} from "./repositoryReconciliation";

export { PublisherProvenNoEffectError } from "./repositoryReconciliation";

export type GenericPaidFunnelPublishJob = GenericPaidFunnelPublish;

const SAFE_PUBLISH_FAILURE_MESSAGES = new Set([
  "At least one file is required for a publisher commit.",
  "Publisher commit file paths must be unique.",
  "Publisher commit file paths must be repository-relative.",
  "Publisher deletion paths must be unique.",
  "Publisher deletion paths must be distinct repository-relative paths.",
  "Protected paid funnel material snapshot is missing.",
  "Protected paid funnel material snapshot is invalid.",
  "Provisioned paid funnel resources are missing or do not match the publish job.",
  "Published repository is missing.",
  "Published repository branch is missing.",
  "Publisher external operation timed out.",
]);

export function safeGenericPaidFunnelPublishFailure(error: unknown): string {
  if (error instanceof PublisherManualAttentionError) return error.message;
  if (error instanceof GitHubApiError) return error.message;
  if (error instanceof CloudflareApiError) return error.message;
  if (
    error instanceof Error &&
    SAFE_PUBLISH_FAILURE_MESSAGES.has(error.message)
  ) {
    return error.message;
  }
  return "Paid funnel publish step failed. Retry to resume.";
}

export type GenericPaidFunnelPublishStepValues = Partial<
  Pick<
    GenericPaidFunnelPublishJob,
    | "repositoryId"
    | "repositoryFullName"
    | "repositoryUrl"
    | "defaultBranch"
    | "provisionedResources"
    | "commitSha"
    | "liveUrl"
    | "dispatchRequestedAt"
    | "workflowRunId"
    | "workflowStatus"
    | "workflowCheckedAt"
    | "runtimeSecretsPatchedAt"
    | "repositoryCreateRequestedAt"
  >
>;

type Completion = {
  nextStep: GenericPaidFunnelPublishStep;
  values: GenericPaidFunnelPublishStepValues;
};

export interface GenericPaidFunnelPublishStore {
  start(input: {
    clientId: number;
    funnelId: number;
    externalFunnelId: string;
    templateKey: string;
    templateVersion: string;
    resourceName: string;
    repositoryName: string;
    workerName: string;
    resourceDefinitions: GenericPaidFunnelResourceDefinitions;
    materialSnapshotEncrypted: string;
    now: Date;
  }): Promise<GenericPaidFunnelPublishJob>;
  get(
    clientId: number,
    funnelId: number
  ): Promise<GenericPaidFunnelPublishJob | null>;
  claim(input: {
    clientId: number;
    funnelId: number;
    allowFailed: boolean;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<GenericPaidFunnelPublishJob | null>;
  markRepositoryCreateRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<GenericPaidFunnelPublishJob | null>;
  markDispatchRequested(input: {
    jobId: string;
    leaseToken: string;
    requestedAt: Date;
  }): Promise<GenericPaidFunnelPublishJob | null>;
  complete(input: {
    jobId: string;
    leaseToken: string;
    expectedStep: GenericPaidFunnelPublishStep;
    completion: Completion;
    now: Date;
  }): Promise<GenericPaidFunnelPublishJob | null>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    message: string;
    now: Date;
    resumeStep?: GenericPaidFunnelPublishStep;
    values?: GenericPaidFunnelPublishStepValues;
  }): Promise<GenericPaidFunnelPublishJob | null>;
}

type WorkflowResult = {
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
};

export interface GenericPaidFunnelPublishExternal {
  preflightDeploymentCredentials(input: { signal: AbortSignal }): Promise<void>;
  ensureRepository(input: {
    externalFunnelId: string;
    repositoryName: string;
    allowCreate: boolean;
    markCreateRequested: () => Promise<void>;
    signal: AbortSignal;
  }): Promise<
    Pick<
      GenericPaidFunnelPublishJob,
      "repositoryId" | "repositoryFullName" | "repositoryUrl" | "defaultBranch"
    >
  >;
  ensureResources(input: {
    definitions: GenericPaidFunnelResourceDefinitions;
    signal: AbortSignal;
  }): Promise<{ provisionedResources: GenericPaidFunnelProvisionedResources }>;
  commitSource(input: {
    publishJobId: string;
    releaseNumber: number;
    repositoryFullName: string;
    defaultBranch: string;
    workerName: string;
    files: Array<{ path: string; content: string }>;
    runtimeVars: Record<string, string>;
    resources: GenericPaidFunnelProvisionedResources;
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
    signal: AbortSignal;
  }): Promise<void>;
  getWorkersDevStatus(input: {
    workerName: string;
    signal: AbortSignal;
  }): Promise<{ liveUrl: string }>;
}

export type GenericPaidFunnelPublishDependencies = {
  store: GenericPaidFunnelPublishStore;
  external: GenericPaidFunnelPublishExternal;
  loadMaterial(
    clientId: number,
    funnelId: number
  ): Promise<GenericPaidFunnelPublishMaterial>;
  now: () => Date;
  createLeaseToken: () => string;
  leaseDurationMs: number;
  externalTimeoutMs: number;
};

type OwnerInput = { clientId: number; funnelId: number; retryFailed?: boolean };
const RECONCILIATION_WINDOW_MS = 60_000;
const DEPLOY_WORKFLOW = "deploy.yml";
const MANAGED_FILES_MANIFEST = ".site-launchpad/managed-files.json";
const REQUIRED_ACTIONS_SECRETS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
] as const;

export async function preflightGeneratedRepositoryActionsSecrets(input: {
  github: Pick<GitHubApiClient, "getOrganizationActionsSecret">;
  organization: string;
  signal: AbortSignal;
}): Promise<void> {
  for (const secretName of REQUIRED_ACTIONS_SECRETS) {
    let secret;
    try {
      secret = await input.github.getOrganizationActionsSecret({
        organization: input.organization,
        secretName,
        signal: input.signal,
      });
    } catch (error) {
      // Repository-scoped publisher tokens can create and deploy repositories but
      // GitHub reserves organization Actions-secret metadata for org admins.
      // A 403 here is not proof that the inherited secret is absent; the generated
      // workflow remains the authoritative deployment gate.
      if (
        error instanceof GitHubApiError &&
        error.operation === "organization Actions secret lookup" &&
        error.status === 403
      ) {
        continue;
      }
      throw error;
    }
    if (!secret || secret.name !== secretName || secret.visibility !== "all") {
      throw new PublisherManualAttentionError(
        `GitHub Actions credential ${secretName} is not available to all generated repositories; manual attention is required.`
      );
    }
  }
}

function isProvenNoEffectGitHubError(error: unknown): boolean {
  return (
    error instanceof GitHubApiError &&
    (error.status === 403 || error.status === 404 || error.status === 422)
  );
}

function validManagedPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    path !== MANAGED_FILES_MANIFEST
  );
}

export function genericPaidFunnelManagedFilePlan(
  currentPaths: readonly string[],
  previousManifest: string | null
): { deletePaths: string[]; manifestContent: string } {
  const paths = [...new Set(currentPaths)].sort();
  if (paths.some(path => !validManagedPath(path))) {
    throw new Error(
      "Generated paid funnel contains an invalid managed file path."
    );
  }
  let previousPaths: string[] = [];
  if (previousManifest !== null) {
    try {
      const parsed: unknown = JSON.parse(decryptSetupValue(previousManifest));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        (parsed as { version?: unknown }).version !== 1 ||
        !Array.isArray((parsed as { paths?: unknown }).paths) ||
        !(parsed as { paths: unknown[] }).paths.every(validManagedPath)
      ) {
        throw new Error("invalid");
      }
      previousPaths = [...new Set((parsed as { paths: string[] }).paths)];
    } catch {
      throw new PublisherManualAttentionError(
        "Generated repository managed-file manifest is invalid; manual attention is required."
      );
    }
  }
  const current = new Set(paths);
  return {
    deletePaths: previousPaths.filter(path => !current.has(path)).sort(),
    manifestContent: encryptSetupValue(JSON.stringify({ version: 1, paths })),
  };
}

function requireValue(value: string | null, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function splitFullName(value: string): { owner: string; repository: string } {
  const [owner, repository, extra] = value.split("/");
  if (!owner || !repository || extra)
    throw new Error("Published repository name is invalid.");
  return { owner, repository };
}

async function bounded<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(new Error("Publisher external operation timed out.")),
    timeoutMs
  );
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function assertWorkflow(
  result: { displayTitle: string; headSha: string },
  job: GenericPaidFunnelPublishJob
): void {
  const sourceSha = requireValue(
    job.commitSha,
    "Published source commit is missing."
  );
  if (
    result.displayTitle !== expectedWorkflowDisplayTitle(job.id, sourceSha) ||
    result.headSha !== sourceSha
  ) {
    throw new PublisherManualAttentionError(
      "Workflow run does not match the paid funnel publish job and source commit; manual attention is required."
    );
  }
}

export function toGenericPaidFunnelPublishStatus(
  job: GenericPaidFunnelPublishJob
): GenericPaidFunnelPublishStatusView {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: genericPaidFunnelPublishProgress(job.step),
    error: job.lastError,
    funnelId: job.funnelId,
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

async function current(
  input: OwnerInput,
  store: GenericPaidFunnelPublishStore
) {
  const job = await store.get(input.clientId, input.funnelId);
  if (!job) throw new Error("Paid funnel publish job not found.");
  return toGenericPaidFunnelPublishStatus(job);
}

async function complete(
  input: OwnerInput,
  job: GenericPaidFunnelPublishJob,
  leaseToken: string,
  completion: Completion,
  deps: GenericPaidFunnelPublishDependencies
) {
  const result = await deps.store.complete({
    jobId: job.id,
    leaseToken,
    expectedStep: job.step,
    completion,
    now: deps.now(),
  });
  return result
    ? toGenericPaidFunnelPublishStatus(result)
    : current(input, deps.store);
}

async function execute(
  input: OwnerInput,
  job: GenericPaidFunnelPublishJob,
  leaseToken: string,
  deps: GenericPaidFunnelPublishDependencies
): Promise<GenericPaidFunnelPublishStatusView> {
  switch (job.step) {
    case "create_repository": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureRepository({
          externalFunnelId: job.externalFunnelId,
          repositoryName: job.repositoryName,
          allowCreate: job.repositoryCreateRequestedAt === null,
          markCreateRequested: async () => {
            const marked = await deps.store.markRepositoryCreateRequested({
              jobId: job.id,
              leaseToken,
              requestedAt: deps.now(),
            });
            if (!marked) throw new Error("Paid funnel publish lease was lost.");
          },
          signal,
        })
      );
      return complete(
        input,
        job,
        leaseToken,
        { nextStep: "ensure_resources", values: result },
        deps
      );
    }
    case "ensure_resources": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.ensureResources({
          definitions: job.resourceDefinitions,
          signal,
        })
      );
      return complete(
        input,
        job,
        leaseToken,
        { nextStep: "commit_source", values: result },
        deps
      );
    }
    case "commit_source": {
      const resources = job.provisionedResources;
      if (
        !resources ||
        resources.d1.length !== job.resourceDefinitions.d1.length ||
        job.resourceDefinitions.d1.some(
          definition =>
            !resources.d1.some(
              resource =>
                resource.binding === definition.binding &&
                resource.name === definition.name
            )
        )
      ) {
        throw new Error(
          "Provisioned paid funnel resources are missing or do not match the publish job."
        );
      }
      const material = openGenericPaidFunnelMaterialSnapshot(
        job.materialSnapshotEncrypted
      );
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.commitSource({
          publishJobId: job.id,
          releaseNumber: job.releaseNumber,
          repositoryFullName: requireValue(
            job.repositoryFullName,
            "Published repository is missing."
          ),
          defaultBranch: requireValue(
            job.defaultBranch,
            "Published repository branch is missing."
          ),
          workerName: job.workerName,
          files: material.files,
          runtimeVars: material.runtimeVars,
          resources,
          signal,
        })
      );
      return complete(
        input,
        job,
        leaseToken,
        { nextStep: "dispatch_workflow", values: result },
        deps
      );
    }
    case "dispatch_workflow": {
      const sourceSha = requireValue(
        job.commitSha,
        "Published source commit is missing."
      );
      if (job.dispatchRequestedAt) {
        const run = await bounded(deps.externalTimeoutMs, signal =>
          deps.external.findWorkflowRun({
            repositoryFullName: requireValue(
              job.repositoryFullName,
              "Published repository is missing."
            ),
            publishJobId: job.id,
            sourceSha,
            afterWorkflowRunId: job.workflowRunId,
            signal,
          })
        );
        const checkedAt = deps.now();
        if (!run) {
          if (
            checkedAt.getTime() - job.dispatchRequestedAt.getTime() <=
            RECONCILIATION_WINDOW_MS
          ) {
            return complete(
              input,
              job,
              leaseToken,
              {
                nextStep: "dispatch_workflow",
                values: { workflowCheckedAt: checkedAt },
              },
              deps
            );
          }
          throw new PublisherManualAttentionError(
            "Workflow dispatch cannot be correlated; automatic redispatch is disabled."
          );
        }
        assertWorkflow(run, job);
        return complete(
          input,
          job,
          leaseToken,
          {
            nextStep: "monitor_workflow",
            values: {
              workflowRunId: run.workflowRunId,
              workflowStatus: run.status,
              workflowCheckedAt: checkedAt,
            },
          },
          deps
        );
      }
      const requestedAt = deps.now();
      const marked = await deps.store.markDispatchRequested({
        jobId: job.id,
        leaseToken,
        requestedAt,
      });
      if (!marked) return current(input, deps.store);
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.dispatchWorkflow({
          repositoryFullName: requireValue(
            marked.repositoryFullName,
            "Published repository is missing."
          ),
          defaultBranch: requireValue(
            marked.defaultBranch,
            "Published repository branch is missing."
          ),
          commitSha: sourceSha,
          publishJobId: marked.id,
          signal,
        })
      );
      return complete(
        input,
        marked,
        leaseToken,
        {
          nextStep: "dispatch_workflow",
          values: { dispatchRequestedAt: requestedAt },
        },
        deps
      );
    }
    case "monitor_workflow": {
      const run = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkflowRun({
          repositoryFullName: requireValue(
            job.repositoryFullName,
            "Published repository is missing."
          ),
          workflowRunId: requireValue(
            job.workflowRunId,
            "Workflow run ID is missing."
          ),
          signal,
        })
      );
      assertWorkflow(run, job);
      const checkedAt = deps.now();
      if (run.status !== "completed") {
        return complete(
          input,
          job,
          leaseToken,
          {
            nextStep: "monitor_workflow",
            values: {
              workflowStatus: run.status,
              workflowCheckedAt: checkedAt,
            },
          },
          deps
        );
      }
      if (run.conclusion !== "success") {
        const failed = await deps.store.fail({
          jobId: job.id,
          leaseToken,
          message:
            "Deployment workflow failed. Retry to redeploy the existing paid funnel source.",
          now: checkedAt,
          resumeStep: "dispatch_workflow",
          values: {
            dispatchRequestedAt: null,
            workflowStatus: run.conclusion ?? "failure",
            workflowCheckedAt: checkedAt,
          },
        });
        return failed
          ? toGenericPaidFunnelPublishStatus(failed)
          : current(input, deps.store);
      }
      return complete(
        input,
        job,
        leaseToken,
        {
          nextStep: "patch_runtime_secrets",
          values: { workflowStatus: "success", workflowCheckedAt: checkedAt },
        },
        deps
      );
    }
    case "patch_runtime_secrets": {
      const material = openGenericPaidFunnelMaterialSnapshot(
        job.materialSnapshotEncrypted
      );
      await bounded(deps.externalTimeoutMs, signal =>
        deps.external.patchRuntimeSecrets({
          workerName: job.workerName,
          runtimeSecrets: material.runtimeSecrets,
          signal,
        })
      );
      return complete(
        input,
        job,
        leaseToken,
        {
          nextStep: "get_live_url",
          values: { runtimeSecretsPatchedAt: deps.now() },
        },
        deps
      );
    }
    case "get_live_url": {
      const result = await bounded(deps.externalTimeoutMs, signal =>
        deps.external.getWorkersDevStatus({
          workerName: job.workerName,
          signal,
        })
      );
      const url = new URL(result.liveUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev")) {
        throw new Error("A workers.dev deployment URL is required.");
      }
      return complete(
        input,
        job,
        leaseToken,
        {
          nextStep: "published",
          values: { liveUrl: result.liveUrl },
        },
        deps
      );
    }
    case "published":
      return toGenericPaidFunnelPublishStatus(job);
  }
}

export async function startGenericPaidFunnelPublish(
  input: { clientId: number; funnelId: number },
  deps: GenericPaidFunnelPublishDependencies
): Promise<GenericPaidFunnelPublishStatusView> {
  await bounded(deps.externalTimeoutMs, signal =>
    deps.external.preflightDeploymentCredentials({ signal })
  );
  const material = await deps.loadMaterial(input.clientId, input.funnelId);
  const names = genericPaidFunnelResourceNames(
    material.clientShortName,
    input.funnelId
  );
  const job = await deps.store.start({
    ...input,
    ...names,
    templateKey: material.templateKey,
    templateVersion: material.templateVersion,
    resourceDefinitions: genericPaidFunnelResourceDefinitions(
      material.package,
      names.resourceName
    ),
    materialSnapshotEncrypted: sealGenericPaidFunnelMaterialSnapshot(material),
    now: deps.now(),
  });
  return toGenericPaidFunnelPublishStatus(job);
}

export async function advanceGenericPaidFunnelPublish(
  input: OwnerInput,
  deps: GenericPaidFunnelPublishDependencies
): Promise<GenericPaidFunnelPublishStatusView> {
  const now = deps.now();
  const leaseToken = deps.createLeaseToken();
  const job = await deps.store.claim({
    clientId: input.clientId,
    funnelId: input.funnelId,
    allowFailed: input.retryFailed === true,
    leaseToken,
    now,
    leaseUntil: new Date(now.getTime() + deps.leaseDurationMs),
  });
  if (!job) return current(input, deps.store);
  try {
    return await execute(input, job, leaseToken, deps);
  } catch (error) {
    const provenNoEffect = error instanceof PublisherProvenNoEffectError;
    const recovery = provenNoEffect
      ? job.step === "create_repository"
        ? {
            resumeStep: "create_repository" as const,
            values: { repositoryCreateRequestedAt: null },
          }
        : job.step === "dispatch_workflow"
          ? {
              resumeStep: "dispatch_workflow" as const,
              values: { dispatchRequestedAt: null },
            }
          : {}
      : {};
    const failed = await deps.store.fail({
      jobId: job.id,
      leaseToken,
      message: safeGenericPaidFunnelPublishFailure(error),
      now: deps.now(),
      ...recovery,
    });
    return failed
      ? toGenericPaidFunnelPublishStatus(failed)
      : current(input, deps.store);
  }
}

function createRuntimeExternal(): GenericPaidFunnelPublishExternal {
  const githubEnvironment = getGitHubPublisherEnvironment();
  const cloudflareEnvironment = getCloudflarePublisherEnvironment();
  const github = createGitHubApiClient({ token: githubEnvironment.token });
  const cloudflare = createCloudflareApiClient(cloudflareEnvironment);
  return {
    async preflightDeploymentCredentials(input) {
      await preflightGeneratedRepositoryActionsSecrets({
        github,
        organization: githubEnvironment.owner,
        signal: input.signal,
      });
    },
    async ensureRepository(input) {
      const description = `Generated generic paid funnel ${input.externalFunnelId}`;
      const repository = await reconcilePublicGeneratedRepository({
        github,
        owner: githubEnvironment.owner,
        repository: input.repositoryName,
        description,
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
    async ensureResources(input) {
      const d1 = [] as GenericPaidFunnelProvisionedResources["d1"];
      for (const definition of input.definitions.d1) {
        const database = await cloudflare.ensureD1Database(
          definition.name,
          input.signal
        );
        d1.push({ ...definition, id: database.id });
      }
      return { provisionedResources: { d1 } };
    },
    async commitSource(input) {
      const repository = splitFullName(input.repositoryFullName);
      const message = `Publish paid funnel ${input.publishJobId} release ${input.releaseNumber}`;
      const existing = await github.findCommitByMessage({
        ...repository,
        branch: input.defaultBranch,
        message,
        signal: input.signal,
      });
      if (existing) return existing;
      const files = [
        ...input.files,
        {
          path: "wrangler.toml",
          content: renderGenericPaidFunnelWranglerToml({
            workerName: input.workerName,
            runtimeVars: input.runtimeVars,
            resources: input.resources,
          }),
        },
        {
          path: ".github/workflows/deploy.yml",
          content: renderGenericPaidFunnelDeployWorkflow(),
        },
      ];
      const previousManifest = await github.getFileText({
        ...repository,
        path: MANAGED_FILES_MANIFEST,
        ref: input.defaultBranch,
        signal: input.signal,
      });
      const managed = genericPaidFunnelManagedFilePlan(
        files.map(file => file.path),
        previousManifest
      );
      files.push({
        path: MANAGED_FILES_MANIFEST,
        content: managed.manifestContent,
      });
      const commit = await github.commitFiles({
        ...repository,
        branch: input.defaultBranch,
        message,
        files,
        deletePaths: managed.deletePaths,
        signal: input.signal,
      });
      return { commitSha: commit.commitSha };
    },
    async dispatchWorkflow(input) {
      const repository = splitFullName(input.repositoryFullName);
      try {
        await github.dispatchWorkflow({
          ...repository,
          workflow: DEPLOY_WORKFLOW,
          ref: input.defaultBranch,
          publishJobId: input.publishJobId,
          sourceSha: input.commitSha,
          signal: input.signal,
        });
      } catch (error) {
        if (isProvenNoEffectGitHubError(error)) {
          throw new PublisherProvenNoEffectError(
            "Workflow dispatch was rejected before taking effect."
          );
        }
        throw error;
      }
    },
    async findWorkflowRun(input) {
      const repository = splitFullName(input.repositoryFullName);
      const cursor = input.afterWorkflowRunId
        ? Number(input.afterWorkflowRunId)
        : undefined;
      const run = await github.findWorkflowRun({
        ...repository,
        workflow: DEPLOY_WORKFLOW,
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
      return github.getWorkflowRun({
        ...repository,
        workflowRunId,
        signal: input.signal,
      });
    },
    async patchRuntimeSecrets(input) {
      await cloudflare.patchWorkerSecrets({
        scriptName: input.workerName,
        secrets: Object.entries(input.runtimeSecrets).map(([name, value]) => ({
          name,
          value,
        })),
        signal: input.signal,
      });
    },
    async getWorkersDevStatus(input) {
      const status = await cloudflare.getWorkersDevStatus({
        scriptName: input.workerName,
        signal: input.signal,
      });
      if (!status.enabled || !status.url) {
        throw new Error(
          "workers.dev is not enabled for the paid funnel Worker."
        );
      }
      return { liveUrl: status.url };
    },
  };
}

let configuredExternal: GenericPaidFunnelPublishExternal | null = null;

export function configureGenericPaidFunnelPublishExternal(
  external: GenericPaidFunnelPublishExternal
): void {
  configuredExternal = external;
}

function runtimeDependencies(): GenericPaidFunnelPublishDependencies {
  return {
    store: genericPaidFunnelPublishStore,
    external: configuredExternal ?? createRuntimeExternal(),
    loadMaterial: getGenericPaidFunnelPublishMaterial,
    now: () => new Date(),
    createLeaseToken: randomUUID,
    leaseDurationMs: 30_000,
    externalTimeoutMs: 15_000,
  };
}

export async function startPublish(
  clientId: number,
  funnelId: number
): Promise<GenericPaidFunnelPublishStatusView> {
  return startGenericPaidFunnelPublish(
    { clientId, funnelId },
    runtimeDependencies()
  );
}

export async function advancePublish(
  clientId: number,
  funnelId: number,
  retryFailed = false
): Promise<GenericPaidFunnelPublishStatusView> {
  return advanceGenericPaidFunnelPublish(
    { clientId, funnelId, retryFailed },
    runtimeDependencies()
  );
}

export async function publishStatus(
  clientId: number,
  funnelId: number
): Promise<GenericPaidFunnelPublishStatusView | null> {
  const job = await genericPaidFunnelPublishStore.get(clientId, funnelId);
  return job ? toGenericPaidFunnelPublishStatus(job) : null;
}
