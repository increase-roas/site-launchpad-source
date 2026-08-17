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
  });

  it("returns the workflow run id from dispatch without listing runs", async () => {
    const { fetchFn, requests } = createMockFetch([
      jsonResponse({ workflow_run_id: 987654321 }, 201),
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
      inputs: { environment: "production" },
    });

    expect(result).toEqual({ workflow_run_id: 987654321 });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.github.com/repos/customer-repositories/northland-simple-form/actions/workflows/deploy.yml/dispatches"
    );
    expect(requests[0]?.init?.headers).toMatchObject({
      "X-GitHub-Api-Version": "2026-03-10",
    });
    expect(requests.some(request => request.url.includes("/runs"))).toBe(false);
  });

  it("rejects an untyped dispatch response without exposing its body", async () => {
    const unsafeResponseValue = "opaque-response-value";
    const { fetchFn } = createMockFetch([
      jsonResponse({ workflow_run_id: unsafeResponseValue }, 201),
    ]);
    const client = createGitHubApiClient({
      token: "opaque-test-credential",
      fetchFn,
    });

    await expect(
      client.dispatchWorkflow({
        owner: "customer-repositories",
        repository: "northland-simple-form",
        workflow: "deploy.yml",
        ref: "main",
      })
    ).rejects.not.toThrow(unsafeResponseValue);
  });

  it("uses the required API version and bounded timeout constants", () => {
    expect(GITHUB_API_VERSION).toBe("2026-03-10");
    expect(DEFAULT_PUBLISHER_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(REPOSITORY_GENERATION_TIMEOUT_MS).toBe(15_000);
  });

  it("allows fifteen seconds only for repository generation", async () => {
    vi.useFakeTimers();
    const fetchFn: FetchFunction = async () =>
      new Promise<Response>(() => undefined);
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
    const fetchFn: FetchFunction = async () =>
      new Promise<Response>(() => undefined);
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
