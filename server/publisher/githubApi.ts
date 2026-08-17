import {
  RequestTimeoutError,
  fetchAwaitingCancellation,
  type FetchFunction,
} from "../../shared/requestTimeout";

export const GITHUB_API_VERSION = "2026-03-10";
export const DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS = 10_000;
export const REPOSITORY_GENERATION_TIMEOUT_MS = 15_000;

export type GeneratePublicRepositoryInput = {
  templateOwner: string;
  templateRepository: string;
  owner: string;
  repository: string;
  description?: string;
  signal: AbortSignal;
};

export type GeneratedRepository = {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
};

export type Repository = GeneratedRepository & {
  ownerLogin: string;
  private: boolean;
  visibility: "public" | "private" | "internal";
  templateOwnerLogin: string | null;
  templateRepositoryName: string | null;
};

export type CommitPublisherFilesInput = {
  owner: string;
  repository: string;
  branch: string;
  message: string;
  files: {
    wranglerToml: string;
    funnelConfigTs: string;
  };
  signal: AbortSignal;
};

export type PublisherCommitResult = {
  branch: string;
  commitSha: string;
  treeSha: string;
};

export type DispatchWorkflowInput = {
  owner: string;
  repository: string;
  workflow: string;
  ref: string;
  publishJobId: string;
  sourceSha: string;
  signal: AbortSignal;
};

export type WorkflowRun = {
  id: number;
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

export type GitHubApiClient = {
  getRepository(input: {
    owner: string;
    repository: string;
    signal: AbortSignal;
  }): Promise<Repository | null>;
  generatePublicRepository(
    input: GeneratePublicRepositoryInput
  ): Promise<GeneratedRepository>;
  commitPublisherFiles(
    input: CommitPublisherFilesInput
  ): Promise<PublisherCommitResult>;
  dispatchWorkflow(
    input: DispatchWorkflowInput
  ): Promise<void>;
  getWorkflowRun(input: {
    owner: string;
    repository: string;
    workflowRunId: number;
    signal: AbortSignal;
  }): Promise<WorkflowRun>;
  findWorkflowRun(input: {
    owner: string;
    repository: string;
    workflow: string;
    publishJobId: string;
    sourceSha: string;
    signal: AbortSignal;
  }): Promise<WorkflowRun | null>;
};

export class GitHubApiError extends Error {
  readonly code = "GITHUB_API_ERROR";

  constructor(
    readonly operation: string,
    readonly status?: number
  ) {
    super(
      status === undefined
        ? `GitHub ${operation} failed.`
        : `GitHub ${operation} failed with HTTP ${status}.`
    );
    this.name = "GitHubApiError";
  }
}

type GitHubRequest = (
  operation: string,
  path: string,
  init: RequestInit,
  signal: AbortSignal,
  options?: {
    timeoutMs?: number;
    allowNotFound?: boolean;
    expectNoContent?: boolean;
  }
) => Promise<unknown | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  operation: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return value;
}

function requireString(
  record: Record<string, unknown>,
  field: string,
  operation: string
): string {
  const value = record[field];
  if (typeof value !== "string" || !value) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return value;
}

function requireBoolean(
  record: Record<string, unknown>,
  field: string,
  operation: string
): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return value;
}

function requirePositiveInteger(
  record: Record<string, unknown>,
  field: string,
  operation: string
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return value;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

function createRequest(options: {
  token: string;
  fetchFn: FetchFunction;
}): GitHubRequest {
  return async (
    operation,
    path,
    init,
    signal,
    requestOptions = {}
  ) => {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetchAwaitingCancellation(
        options.fetchFn,
        `https://api.github.com${path}`,
        {
          ...init,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
            ...(init.headers ?? {}),
          },
          signal,
        },
        requestOptions.timeoutMs ?? DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS
      );
    } catch (error) {
      if (error instanceof RequestTimeoutError) throw error;
      signal.throwIfAborted();
      throw new GitHubApiError(operation);
    }
    signal.throwIfAborted();
    if (!response.ok) {
      if (requestOptions.allowNotFound && response.status === 404) {
        return null;
      }
      throw new GitHubApiError(operation, response.status);
    }
    if (requestOptions.expectNoContent) return null;
    try {
      const body: unknown = await response.json();
      signal.throwIfAborted();
      return body;
    } catch {
      signal.throwIfAborted();
      throw new GitHubApiError(`${operation} response validation`);
    }
  };
}

function parseRepository(value: unknown): Repository {
  const operation = "repository lookup";
  const record = requireRecord(value, operation);
  const owner = requireRecord(record.owner, operation);
  const visibility = requireString(record, "visibility", operation);
  if (
    visibility !== "public" &&
    visibility !== "private" &&
    visibility !== "internal"
  ) {
    throw new GitHubApiError(`${operation} response validation`);
  }

  const templateRepository = record.template_repository;
  let templateOwnerLogin: string | null = null;
  let templateRepositoryName: string | null = null;
  if (templateRepository !== undefined && templateRepository !== null) {
    const template = requireRecord(templateRepository, operation);
    const templateOwner = requireRecord(template.owner, operation);
    templateOwnerLogin = requireString(templateOwner, "login", operation);
    templateRepositoryName = requireString(template, "name", operation);
  }

  return {
    id: requirePositiveInteger(record, "id", operation),
    ownerLogin: requireString(owner, "login", operation),
    name: requireString(record, "name", operation),
    fullName: requireString(record, "full_name", operation),
    private: requireBoolean(record, "private", operation),
    visibility,
    templateOwnerLogin,
    templateRepositoryName,
    htmlUrl: requireString(record, "html_url", operation),
    defaultBranch: requireString(record, "default_branch", operation),
  };
}

function parseGeneratedRepository(value: unknown): GeneratedRepository {
  const operation = "repository generation";
  const record = requireRecord(value, operation);
  if (record.private !== false) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return {
    id: requirePositiveInteger(record, "id", operation),
    name: requireString(record, "name", operation),
    fullName: requireString(record, "full_name", operation),
    htmlUrl: requireString(record, "html_url", operation),
    defaultBranch: requireString(record, "default_branch", operation),
  };
}

function parseObjectSha(value: unknown, operation: string): string {
  const record = requireRecord(value, operation);
  const object = requireRecord(record.object, operation);
  return requireString(object, "sha", operation);
}

function parseCommitTreeSha(value: unknown): string {
  const operation = "commit lookup";
  const record = requireRecord(value, operation);
  const tree = requireRecord(record.tree, operation);
  return requireString(tree, "sha", operation);
}

function parseSha(value: unknown, operation: string): string {
  return requireString(requireRecord(value, operation), "sha", operation);
}

function parseWorkflowRun(value: unknown): WorkflowRun {
  const operation = "workflow run lookup";
  const record = requireRecord(value, operation);
  const status = requireString(record, "status", operation);
  if (
    status !== "queued" &&
    status !== "in_progress" &&
    status !== "completed"
  ) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  const conclusion = record.conclusion;
  if (
    conclusion !== null &&
    conclusion !== "success" &&
    conclusion !== "failure" &&
    conclusion !== "cancelled" &&
    conclusion !== "timed_out" &&
    conclusion !== "action_required"
  ) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return {
    id: requirePositiveInteger(record, "id", operation),
    status,
    conclusion,
    headSha: requireString(record, "head_sha", operation),
    displayTitle: requireString(record, "display_title", operation),
  };
}

function parseWorkflowRuns(value: unknown): WorkflowRun[] {
  const operation = "workflow run reconciliation";
  const record = requireRecord(value, operation);
  if (!Array.isArray(record.workflow_runs)) {
    throw new GitHubApiError(`${operation} response validation`);
  }
  return record.workflow_runs.map(parseWorkflowRun);
}

export function expectedWorkflowDisplayTitle(
  publishJobId: string,
  sourceSha: string
): string {
  return `Deploy ${publishJobId} ${sourceSha}`;
}

export function createGitHubApiClient(options: {
  token: string;
  fetchFn?: FetchFunction;
}): GitHubApiClient {
  const request = createRequest({
    token: options.token,
    fetchFn: options.fetchFn ?? globalThis.fetch,
  });

  return {
    async getRepository(input) {
      const response = await request(
        "repository lookup",
        `/repos/${encoded(input.owner)}/${encoded(input.repository)}`,
        { method: "GET" },
        input.signal,
        { allowNotFound: true }
      );
      return response === null ? null : parseRepository(response);
    },
    async generatePublicRepository(input) {
      const response = await request(
        "repository generation",
        `/repos/${encoded(input.templateOwner)}/${encoded(input.templateRepository)}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            owner: input.owner,
            name: input.repository,
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            private: false,
            include_all_branches: false,
          }),
        },
        input.signal,
        { timeoutMs: REPOSITORY_GENERATION_TIMEOUT_MS }
      );
      return parseGeneratedRepository(response);
    },
    async commitPublisherFiles(input) {
      const repositoryPath = `/repos/${encoded(input.owner)}/${encoded(input.repository)}`;
      const branch = encoded(input.branch);
      const refResponse = await request(
        "branch lookup",
        `${repositoryPath}/git/ref/heads/${branch}`,
        { method: "GET" },
        input.signal
      );
      const parentCommitSha = parseObjectSha(refResponse, "branch lookup");
      const commitResponse = await request(
        "commit lookup",
        `${repositoryPath}/git/commits/${encoded(parentCommitSha)}`,
        { method: "GET" },
        input.signal
      );
      const baseTreeSha = parseCommitTreeSha(commitResponse);
      const treeResponse = await request(
        "tree creation",
        `${repositoryPath}/git/trees`,
        {
          method: "POST",
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: [
              {
                path: "wrangler.toml",
                mode: "100644",
                type: "blob",
                content: input.files.wranglerToml,
              },
              {
                path: "funnel.config.ts",
                mode: "100644",
                type: "blob",
                content: input.files.funnelConfigTs,
              },
            ],
          }),
        },
        input.signal
      );
      const treeSha = parseSha(treeResponse, "tree creation");
      const newCommitResponse = await request(
        "commit creation",
        `${repositoryPath}/git/commits`,
        {
          method: "POST",
          body: JSON.stringify({
            message: input.message,
            tree: treeSha,
            parents: [parentCommitSha],
          }),
        },
        input.signal
      );
      const commitSha = parseSha(newCommitResponse, "commit creation");
      const updateResponse = await request(
        "branch update",
        `${repositoryPath}/git/refs/heads/${branch}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: commitSha,
            force: false,
          }),
        },
        input.signal
      );
      const updatedSha = parseObjectSha(updateResponse, "branch update");
      if (updatedSha !== commitSha) {
        throw new GitHubApiError("branch update response validation");
      }
      return {
        branch: input.branch,
        commitSha,
        treeSha,
      };
    },
    async dispatchWorkflow(input) {
      await request(
        "workflow dispatch",
        `/repos/${encoded(input.owner)}/${encoded(input.repository)}/actions/workflows/${encoded(input.workflow)}/dispatches`,
        {
          method: "POST",
          body: JSON.stringify({
            ref: input.ref,
            inputs: {
              publish_job_id: input.publishJobId,
              source_sha: input.sourceSha,
            },
          }),
        },
        input.signal,
        { expectNoContent: true }
      );
    },
    async getWorkflowRun(input) {
      const response = await request(
        "workflow run lookup",
        `/repos/${encoded(input.owner)}/${encoded(input.repository)}/actions/runs/${input.workflowRunId}`,
        { method: "GET" },
        input.signal
      );
      return parseWorkflowRun(response);
    },
    async findWorkflowRun(input) {
      const response = await request(
        "workflow run reconciliation",
        `/repos/${encoded(input.owner)}/${encoded(input.repository)}/actions/workflows/${encoded(input.workflow)}/runs?event=workflow_dispatch&per_page=50&page=1`,
        { method: "GET" },
        input.signal
      );
      const expectedDisplayTitle = expectedWorkflowDisplayTitle(
        input.publishJobId,
        input.sourceSha
      );
      return (
        parseWorkflowRuns(response).find(
          run => run.displayTitle === expectedDisplayTitle
        ) ?? null
      );
    },
  };
}
