import {
  RequestTimeoutError,
  fetchWithTimeout,
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
};

export type GeneratedRepository = {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
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
  inputs?: Readonly<Record<string, string>>;
};

export type WorkflowDispatchResponse = {
  workflow_run_id: number;
};

export type GitHubApiClient = {
  generatePublicRepository(
    input: GeneratePublicRepositoryInput
  ): Promise<GeneratedRepository>;
  commitPublisherFiles(
    input: CommitPublisherFilesInput
  ): Promise<PublisherCommitResult>;
  dispatchWorkflow(
    input: DispatchWorkflowInput
  ): Promise<WorkflowDispatchResponse>;
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
  timeoutMs?: number
) => Promise<unknown>;

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
    timeoutMs = DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS
  ) => {
    let response: Response;
    try {
      response = await fetchWithTimeout(
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
        },
        timeoutMs
      );
    } catch (error) {
      if (error instanceof RequestTimeoutError) throw error;
      throw new GitHubApiError(operation);
    }
    if (!response.ok) {
      throw new GitHubApiError(operation, response.status);
    }
    try {
      const body: unknown = await response.json();
      return body;
    } catch {
      throw new GitHubApiError(`${operation} response validation`);
    }
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

function parseWorkflowDispatch(value: unknown): WorkflowDispatchResponse {
  const operation = "workflow dispatch";
  const record = requireRecord(value, operation);
  return {
    workflow_run_id: requirePositiveInteger(
      record,
      "workflow_run_id",
      operation
    ),
  };
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
        REPOSITORY_GENERATION_TIMEOUT_MS
      );
      return parseGeneratedRepository(response);
    },
    async commitPublisherFiles(input) {
      const repositoryPath = `/repos/${encoded(input.owner)}/${encoded(input.repository)}`;
      const branch = encoded(input.branch);
      const refResponse = await request(
        "branch lookup",
        `${repositoryPath}/git/ref/heads/${branch}`,
        { method: "GET" }
      );
      const parentCommitSha = parseObjectSha(refResponse, "branch lookup");
      const commitResponse = await request(
        "commit lookup",
        `${repositoryPath}/git/commits/${encoded(parentCommitSha)}`,
        { method: "GET" }
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
        }
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
        }
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
        }
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
      const response = await request(
        "workflow dispatch",
        `/repos/${encoded(input.owner)}/${encoded(input.repository)}/actions/workflows/${encoded(input.workflow)}/dispatches`,
        {
          method: "POST",
          body: JSON.stringify({
            ref: input.ref,
            ...(input.inputs === undefined ? {} : { inputs: input.inputs }),
          }),
        }
      );
      return parseWorkflowDispatch(response);
    },
  };
}
