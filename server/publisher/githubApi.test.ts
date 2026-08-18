import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchFunction } from "../../shared/requestTimeout";
import {
  DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS,
  GITHUB_API_VERSION,
  REPOSITORY_GENERATION_TIMEOUT_MS,
  createGitHubApiClient,
} from "./githubApi";

type RecordedRequest = {
  url: string;
  init: RequestInit | undefined;
};

const PERSISTED_SOURCE_SHA =
  "0123456789abcdef0123456789abcdef01234567";
const EXPECTED_WORKFLOW_TITLE =
  `Deploy publish-job-123 ${PERSISTED_SOURCE_SHA}`;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockFetch(responses: readonly Response[]): {
  fetchFn: FetchFunction;
  requests: RecordedRequest[];
} {
  const pending = [...responses];
  const requests: RecordedRequest[] = [];
  const fetchFn: FetchFunction = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = pending.shift();
    if (!response) throw new Error("Unexpected mocked request.");
    return response;
  };
  return { fetchFn, requests };
}

function abortSignal(): AbortSignal {
  return new AbortController().signal;
}

function parseRequestBody(
  request: RecordedRequest | undefined
): Record<string, unknown> {
  if (!request || typeof request.init?.body !== "string") {
    throw new Error("Expected a JSON request body.");
  }
  const parsed: unknown = JSON.parse(request.init.body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object request body.");
  }
  return parsed as Record<string, unknown>;
}

describe("GitHub publisher client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the exact reviewed template branch head", async () => {
    const { fetchFn } = createMockFetch([
      jsonResponse({ object: { sha: PERSISTED_SOURCE_SHA } }),
    ]);
    const client = createGitHubApiClient({ token: "opaque-test-credential", fetchFn });
    await expect(
      client.getBranchHeadSha({
        owner: "increaseroasir",
        repository: "32-htl-website-template-astrobuild",
        branch: "main",
        signal: abortSignal(),
      }),
    ).resolves.toBe(PERSISTED_SOURCE_SHA);
  });

  it("generates a public repository from the configured template", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse(
        {
          id: 101,
          name: "northland-simple-form",
          full_name: "customer-repositories/northland-simple-form",
          html_url:
            "https://github.com/customer-repositories/northland-simple-form",
          default_branch: "main",
          private: false,
        },
        201
      ),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    const result = await client.generatePublicRepository({
      templateOwner: "increase-roas",
      templateRepository: "paid-funnel-simple-form-funnel",
      owner: "customer-repositories",
      repository: "northland-simple-form",
      description: "Northland Simple Form funnel",
      signal: abortSignal(),
    });

    expect(result).toEqual({
      id: 101,
      name: "northland-simple-form",
      fullName: "customer-repositories/northland-simple-form",
      htmlUrl: "https://github.com/customer-repositories/northland-simple-form",
      defaultBranch: "main",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.github.com/repos/increase-roas/paid-funnel-simple-form-funnel/generate",
      init: { method: "POST" },
    });
    expect(parseRequestBody(requests[0])).toEqual({
      owner: "customer-repositories",
      name: "northland-simple-form",
      description: "Northland Simple Form funnel",
      private: false,
      include_all_branches: false,
    });
    expect(requests[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("creates an auto-initialized public organization repository for generated source", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse(
        {
          id: 102,
          name: "funnel-northland-7",
          full_name: "customer-repositories/funnel-northland-7",
          html_url: "https://github.com/customer-repositories/funnel-northland-7",
          default_branch: "main",
          private: false,
        },
        201,
      ),
    ]);
    const client = createGitHubApiClient({ token: "opaque-test-credential", fetchFn });

    await expect(client.createPublicRepository({
      owner: "customer-repositories",
      repository: "funnel-northland-7",
      description: "Generated generic paid funnel generic-paid-funnel-7",
      signal: abortSignal(),
    })).resolves.toMatchObject({ id: 102, defaultBranch: "main" });
    expect(requests[0]).toMatchObject({
      url: "https://api.github.com/orgs/customer-repositories/repos",
      init: { method: "POST" },
    });
    expect(parseRequestBody(requests[0])).toEqual({
      name: "funnel-northland-7",
      description: "Generated generic paid funnel generic-paid-funnel-7",
      private: false,
      auto_init: true,
    });
  });

  it("gets repository identity and template provenance", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({
        id: 101,
        owner: { login: "customer-repositories" },
        name: "northland-simple-form",
        full_name: "customer-repositories/northland-simple-form",
        private: false,
        visibility: "public",
        template_repository: {
          owner: { login: "increase-roas" },
          name: "paid-funnel-simple-form-funnel",
        },
        html_url:
          "https://github.com/customer-repositories/northland-simple-form",
        default_branch: "main",
      }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.getRepository({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        signal: abortSignal(),
      })
    ).resolves.toEqual({
      id: 101,
      ownerLogin: "customer-repositories",
      description: null,
      name: "northland-simple-form",
      fullName: "customer-repositories/northland-simple-form",
      private: false,
      visibility: "public",
      templateOwnerLogin: "increase-roas",
      templateRepositoryName: "paid-funnel-simple-form-funnel",
      htmlUrl: "https://github.com/customer-repositories/northland-simple-form",
      defaultBranch: "main",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.github.com/repos/customer-repositories/northland-simple-form",
      init: { method: "GET" },
    });
  });

  it("treats only repository lookup 404 as absent", async () => {
    const notFound = createMockFetch([jsonResponse({ message: "Not Found" }, 404)]);
    const forbidden = createMockFetch([jsonResponse({ message: "Forbidden" }, 403)]);
    const notFoundClient = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn: notFound.fetchFn,
    });
    const forbiddenClient = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn: forbidden.fetchFn,
    });

    await expect(
      notFoundClient.getRepository({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        signal: abortSignal(),
      })
    ).resolves.toBeNull();
    await expect(
      forbiddenClient.getRepository({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        signal: abortSignal(),
      })
    ).rejects.toMatchObject({
      name: "GitHubApiError",
      operation: "repository lookup",
      status: 403,
    });
  });

  it("creates one atomic tree and non-force commit for exactly two files", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({ object: { sha: "base-commit-sha" } }),
      jsonResponse({ tree: { sha: "base-tree-sha" } }),
      jsonResponse({ sha: "new-tree-sha" }, 201),
      jsonResponse({ sha: "new-commit-sha" }, 201),
      jsonResponse({ object: { sha: "new-commit-sha" } }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    const result = await client.commitPublisherFiles({
      owner: "customer-repositories",
      repository: "northland-simple-form",
      branch: "main",
      message: "chore: configure generated funnel",
      files: {
        wranglerToml: 'name = "northland-simple-form"\n',
        funnelConfigTs: "export default {};\n",
      },
      signal: abortSignal(),
    });

    expect(result).toEqual({
      branch: "main",
      commitSha: "new-commit-sha",
      treeSha: "new-tree-sha",
    });
    expect(
      requests.map(request => [request.init?.method, request.url])
    ).toEqual([
      [
        "GET",
        "https://api.github.com/repos/customer-repositories/northland-simple-form/git/ref/heads/main",
      ],
      [
        "GET",
        "https://api.github.com/repos/customer-repositories/northland-simple-form/git/commits/base-commit-sha",
      ],
      [
        "POST",
        "https://api.github.com/repos/customer-repositories/northland-simple-form/git/trees",
      ],
      [
        "POST",
        "https://api.github.com/repos/customer-repositories/northland-simple-form/git/commits",
      ],
      [
        "PATCH",
        "https://api.github.com/repos/customer-repositories/northland-simple-form/git/refs/heads/main",
      ],
    ]);
    expect(parseRequestBody(requests[2])).toEqual({
      base_tree: "base-tree-sha",
      tree: [
        {
          path: "wrangler.toml",
          mode: "100644",
          type: "blob",
          content: 'name = "northland-simple-form"\n',
        },
        {
          path: "funnel.config.ts",
          mode: "100644",
          type: "blob",
          content: "export default {};\n",
        },
      ],
    });
    expect(parseRequestBody(requests[3])).toEqual({
      message: "chore: configure generated funnel",
      tree: "new-tree-sha",
      parents: ["base-commit-sha"],
    });
    expect(parseRequestBody(requests[4])).toEqual({
      sha: "new-commit-sha",
      force: false,
    });
    expect(requests.every(request => !request.url.includes("/contents/"))).toBe(
      true
    );
    expect(
      requests.every(request => request.init?.signal instanceof AbortSignal)
    ).toBe(true);
  });

  it("commits arbitrary repository-relative website files atomically", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({ object: { sha: "base-commit-sha" } }),
      jsonResponse({ tree: { sha: "base-tree-sha" } }),
      jsonResponse({ sha: "new-tree-sha" }, 201),
      jsonResponse({ sha: "new-commit-sha" }, 201),
      jsonResponse({ object: { sha: "new-commit-sha" } }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await client.commitFiles({
      owner: "customer-repositories",
      repository: "northland-website",
      branch: "main",
      message: "chore: configure generated website",
      files: [
        {
          path: "src/config/client.config.ts",
          content: "export const rawClientConfig = {};\n",
        },
        { path: "wrangler.toml", content: 'name = "northland-website"\n' },
      ],
      signal: abortSignal(),
    });

    expect(parseRequestBody(requests[2])).toMatchObject({
      tree: [
        {
          path: "src/config/client.config.ts",
          content: "export const rawClientConfig = {};\n",
        },
        {
          path: "wrangler.toml",
          content: 'name = "northland-website"\n',
        },
      ],
    });
  });

  it("does not begin another commit request after cancellation", async () => {
    const controller = new AbortController();
    const abortReason = new DOMException("Stop publishing.", "AbortError");
    const requests: RecordedRequest[] = [];
    const fetchFn: FetchFunction = async (input, init) => {
      requests.push({ url: String(input), init });
      return {
        ok: true,
        status: 200,
        json: async () => {
          controller.abort(abortReason);
          return { object: { sha: "base-commit-sha" } };
        },
      } as Response;
    };
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.commitPublisherFiles({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        branch: "main",
        message: "chore: configure generated funnel",
        files: {
          wranglerToml: 'name = "northland-simple-form"\n',
          funnelConfigTs: "export default {};\n",
        },
        signal: controller.signal,
      })
    ).rejects.toBe(abortReason);
    expect(requests).toHaveLength(1);
  });

  it("does not begin an initially cancelled request", async () => {
    const controller = new AbortController();
    const abortReason = new DOMException("Stop publishing.", "AbortError");
    controller.abort(abortReason);
    const fetchFn = vi.fn<FetchFunction>();
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.generatePublicRepository({
        templateOwner: "increase-roas",
        templateRepository: "paid-funnel-simple-form-funnel",
        owner: "customer-repositories",
        repository: "northland-simple-form",
        signal: controller.signal,
      })
    ).rejects.toBe(abortReason);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("waits for an aborted request to settle before returning", async () => {
    const controller = new AbortController();
    const abortReason = new DOMException("Stop publishing.", "AbortError");
    let settleRequest: (() => void) | undefined;
    const fetchFn: FetchFunction = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            settleRequest = () => reject(init.signal?.reason);
          },
          { once: true }
        );
      });
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });
    const completion = vi.fn();
    const request = client.getRepository({
      owner: "customer-repositories",
      repository: "northland-simple-form",
      signal: controller.signal,
    });
    void request.then(
      () => completion("resolved"),
      error => completion(error)
    );

    controller.abort(abortReason);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(completion).not.toHaveBeenCalled();
    settleRequest?.();
    await expect(request).rejects.toBe(abortReason);
  });

  it("accepts the documented 204 dispatch without parsing a run id", async () => {
    const { fetchFn, requests } = createMockFetch([
      new Response(null, { status: 204 }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    const result = await client.dispatchWorkflow({
      owner: "customer-repositories",
      repository: "northland-simple-form",
      workflow: "deploy.yml",
      ref: "main",
      publishJobId: "publish-job-123",
      sourceSha: PERSISTED_SOURCE_SHA,
      signal: abortSignal(),
    });

    expect(result).toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.github.com/repos/customer-repositories/northland-simple-form/actions/workflows/deploy.yml/dispatches"
    );
    expect(requests[0]?.init?.headers).toMatchObject({
      "X-GitHub-Api-Version": "2026-03-10",
    });
    expect(parseRequestBody(requests[0])).toEqual({
      ref: "main",
      inputs: {
        publish_job_id: "publish-job-123",
        source_sha: PERSISTED_SOURCE_SHA,
      },
    });
    expect(requests.some(request => request.url.includes("/runs"))).toBe(false);
  });

  it("reconciles an ambiguous source commit by its exact idempotency message", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse([
        {
          sha: "newer-sha",
          commit: { message: "another commit" },
        },
        {
          sha: PERSISTED_SOURCE_SHA,
          commit: { message: "Publish website job-123 source" },
        },
      ]),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.findCommitByMessage({
        owner: "customer-repositories",
        repository: "northland-website",
        branch: "main",
        message: "Publish website job-123 source",
        signal: abortSignal(),
      }),
    ).resolves.toEqual({ commitSha: PERSISTED_SOURCE_SHA });
    expect(requests[0]?.url).toContain(
      "/repos/customer-repositories/northland-website/commits?sha=main&per_page=100",
    );
  });

  it("looks up only the persisted workflow run id without treating head SHA as source SHA", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({
        id: 987654321,
        status: "completed",
        conclusion: "success",
        head_sha: "newer-default-branch-head",
        display_title: EXPECTED_WORKFLOW_TITLE,
      }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.getWorkflowRun({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        workflowRunId: 987654321,
        signal: abortSignal(),
      })
    ).resolves.toEqual({
      id: 987654321,
      status: "completed",
      conclusion: "success",
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.github.com/repos/customer-repositories/northland-simple-form/actions/runs/987654321",
      init: { method: "GET" },
    });
  });

  it("finds only a recent dispatch with exact display-title source correlation", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({
        workflow_runs: [
          {
            id: 1,
            status: "completed",
            conclusion: "success",
            head_sha: "newer-branch-sha",
            display_title: `Deploy publish-job-123 ${"f".repeat(40)}`,
          },
          {
            id: 2,
            status: "completed",
            conclusion: "success",
            head_sha: "newer-branch-sha",
            display_title: `${EXPECTED_WORKFLOW_TITLE}-extra`,
          },
          {
            id: 3,
            status: "in_progress",
            conclusion: null,
            head_sha: "newer-branch-sha",
            display_title: EXPECTED_WORKFLOW_TITLE,
          },
          {
            id: 4,
            status: "queued",
            conclusion: null,
            head_sha: "newer-branch-sha",
            display_title: EXPECTED_WORKFLOW_TITLE,
          },
        ],
      }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.findWorkflowRun({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        workflow: "deploy.yml",
        publishJobId: "publish-job-123",
        sourceSha: PERSISTED_SOURCE_SHA,
        afterWorkflowRunId: 3,
        signal: abortSignal(),
      })
    ).resolves.toEqual({
      id: 4,
      status: "queued",
      conclusion: null,
      headSha: "newer-branch-sha",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.github.com/repos/customer-repositories/northland-simple-form/actions/workflows/deploy.yml/runs?event=workflow_dispatch&per_page=50&page=1"
    );
  });

  it("returns null when recent dispatches do not match the exact title", async () => {
    const { fetchFn } = createMockFetch([
      jsonResponse({
        workflow_runs: [
          {
            id: 1,
            status: "completed",
            conclusion: "success",
            head_sha: "newer-branch-sha",
            display_title: `Deploy publish-job-123 ${"f".repeat(40)}`,
          },
        ],
      }),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.findWorkflowRun({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        workflow: "deploy.yml",
        publishJobId: "publish-job-123",
        sourceSha: PERSISTED_SOURCE_SHA,
        signal: abortSignal(),
      })
    ).resolves.toBeNull();
  });

  it("uses the required API version and bounded timeout constants", () => {
    expect(GITHUB_API_VERSION).toBe("2026-03-10");
    expect(DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(REPOSITORY_GENERATION_TIMEOUT_MS).toBe(15_000);
  });

  it("allows fifteen seconds only for repository generation", async () => {
    vi.useFakeTimers();
    const fetchFn: FetchFunction = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true }
        );
      });
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });
    const completion = vi.fn();
    void client
      .generatePublicRepository({
        templateOwner: "increase-roas",
        templateRepository: "paid-funnel-simple-form-funnel",
        owner: "customer-repositories",
        repository: "northland-simple-form",
        signal: abortSignal(),
      })
      .then(
        () => completion("resolved"),
        error => completion(error)
      );

    await vi.advanceTimersByTimeAsync(14_999);
    expect(completion).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "RequestTimeoutError",
        timeoutMs: 15_000,
      })
    );
  });

  it("uses ten seconds for workflow dispatch", async () => {
    vi.useFakeTimers();
    const fetchFn: FetchFunction = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true }
        );
      });
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });
    const completion = vi.fn();
    void client
      .dispatchWorkflow({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        workflow: "deploy.yml",
        ref: "main",
        publishJobId: "publish-job-123",
        sourceSha: "persisted-source-sha",
        signal: abortSignal(),
      })
      .then(
        () => completion("resolved"),
        error => completion(error)
      );

    await vi.advanceTimersByTimeAsync(9_999);
    expect(completion).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "RequestTimeoutError",
        timeoutMs: 10_000,
      })
    );
  });
});
