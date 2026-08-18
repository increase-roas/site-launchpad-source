import { describe, expect, it, vi } from "vitest";
import type {
  GenericPaidFunnelPublishDependencies,
  GenericPaidFunnelPublishJob,
} from "./publishGenericPaidFunnel";
import {
  PublisherProvenNoEffectError,
  advanceGenericPaidFunnelPublish,
  genericPaidFunnelManagedFilePlan,
  preflightGeneratedRepositoryActionsSecrets,
  safeGenericPaidFunnelPublishFailure,
  startGenericPaidFunnelPublish,
} from "./publishGenericPaidFunnel";
import { GitHubApiError } from "./githubApi";
import { CloudflareApiError } from "./cloudflareApi";
import { samePersistedContractJson } from "./genericPaidFunnelPublishDb";
import { decryptSetupValue } from "../clientSecurity";
import { sealGenericPaidFunnelMaterialSnapshot } from "./genericPaidFunnelMaterial";

function jobFixture(): GenericPaidFunnelPublishJob {
  const now = new Date("2026-08-18T12:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: 5,
    funnelId: 7,
    externalFunnelId: "generic-paid-funnel-7",
    templateKey: "qa-generic-paid-funnel",
    templateVersion: "1.0.0",
    resourceName: "funnel-north-star-7",
    repositoryName: "funnel-north-star-7",
    workerName: "funnel-north-star-7",
    resourceDefinitions: {
      d1: [{ binding: "FUNNEL_DB", name: "funnel-north-star-7-1" }],
    },
    provisionedResources: {
      d1: [
        { binding: "FUNNEL_DB", name: "funnel-north-star-7-1", id: "d1-id" },
      ],
    },
    releaseNumber: 1,
    step: "monitor_workflow",
    status: "pending",
    repositoryId: "42",
    repositoryFullName: "increase-roas/funnel-north-star-7",
    repositoryUrl: "https://github.com/increase-roas/funnel-north-star-7",
    defaultBranch: "main",
    repositoryCreateRequestedAt: now,
    commitSha: "source-sha",
    liveUrl: null,
    dispatchRequestedAt: now,
    workflowRunId: "100",
    workflowStatus: "in_progress",
    workflowCheckedAt: now,
    runtimeSecretsPatchedAt: null,
    materialSnapshotEncrypted: "v2.test.snapshot.payload",
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    attemptCount: 3,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function inMemoryDependencies(initial: GenericPaidFunnelPublishJob) {
  let job = { ...initial };
  let clock = initial.updatedAt.getTime();
  const dispatchWorkflow = vi.fn().mockResolvedValue(undefined);
  const findWorkflowRun = vi.fn().mockResolvedValue({
    workflowRunId: "101",
    status: "queued",
    conclusion: null,
    headSha: "source-sha",
    displayTitle: `Deploy ${initial.id} source-sha`,
  });
  const getWorkflowRun = vi.fn().mockResolvedValue({
    status: "completed",
    conclusion: "failure",
    headSha: "source-sha",
    displayTitle: `Deploy ${initial.id} source-sha`,
  });
  const unused = vi
    .fn()
    .mockRejectedValue(new Error("unexpected external call"));
  const deps: GenericPaidFunnelPublishDependencies = {
    now: () => new Date(++clock),
    createLeaseToken: () => "22222222-2222-4222-8222-222222222222",
    leaseDurationMs: 30_000,
    externalTimeoutMs: 5_000,
    loadMaterial: vi
      .fn()
      .mockRejectedValue(new Error("unexpected material load")),
    external: {
      preflightDeploymentCredentials: vi.fn().mockResolvedValue(undefined),
      ensureRepository: unused,
      ensureResources: unused,
      commitSource: unused,
      dispatchWorkflow,
      findWorkflowRun,
      getWorkflowRun,
      patchRuntimeSecrets: unused,
      getWorkersDevStatus: unused,
    },
    store: {
      start: vi.fn(),
      get: async () => ({ ...job }),
      claim: async input => {
        if (
          job.status === "published" ||
          (job.status === "failed" && !input.allowFailed)
        )
          return null;
        job = {
          ...job,
          status: "running",
          leaseToken: input.leaseToken,
          leaseUntil: input.leaseUntil,
          lastError: null,
          attemptCount: job.attemptCount + 1,
          updatedAt: input.now,
        };
        return { ...job };
      },
      markRepositoryCreateRequested: async input => {
        if (
          job.repositoryCreateRequestedAt ||
          job.leaseToken !== input.leaseToken
        )
          return null;
        job = {
          ...job,
          repositoryCreateRequestedAt: input.requestedAt,
          updatedAt: input.requestedAt,
        };
        return { ...job };
      },
      markDispatchRequested: async input => {
        if (job.dispatchRequestedAt || job.leaseToken !== input.leaseToken)
          return null;
        job = {
          ...job,
          dispatchRequestedAt: input.requestedAt,
          updatedAt: input.requestedAt,
        };
        return { ...job };
      },
      complete: async input => {
        if (
          job.leaseToken !== input.leaseToken ||
          job.step !== input.expectedStep
        )
          return null;
        job = {
          ...job,
          ...input.completion.values,
          step: input.completion.nextStep,
          status:
            input.completion.nextStep === "published" ? "published" : "pending",
          leaseToken: null,
          leaseUntil: null,
          lastError: null,
          updatedAt: input.now,
        };
        return { ...job };
      },
      fail: async input => {
        if (job.leaseToken !== input.leaseToken) return null;
        job = {
          ...job,
          ...(input.values ?? {}),
          step: input.resumeStep ?? job.step,
          status: "failed",
          leaseToken: null,
          leaseUntil: null,
          lastError: input.message,
          updatedAt: input.now,
        };
        return { ...job };
      },
    },
  };
  return {
    deps,
    dispatchWorkflow,
    findWorkflowRun,
    getWorkflowRun,
    current: () => job,
  };
}

describe("generic Astro paid funnel workflow Retry", () => {
  it("reuses a persisted JSONB resource contract regardless of object key order", () => {
    expect(
      samePersistedContractJson(
        { d1: [{ name: "funnel-example-1-1", binding: "FUNNEL_DB" }] },
        { d1: [{ binding: "FUNNEL_DB", name: "funnel-example-1-1" }] }
      )
    ).toBe(true);
  });

  it("reports actionable GitHub failures without exposing arbitrary error text", () => {
    expect(
      safeGenericPaidFunnelPublishFailure(
        new GitHubApiError("tree creation", 422)
      )
    ).toBe("GitHub tree creation failed with HTTP 422.");
    expect(
      safeGenericPaidFunnelPublishFailure(
        new Error("secret-shaped upstream response")
      )
    ).toBe("Paid funnel publish step failed. Retry to resume.");
  });

  it("reports actionable Cloudflare failures without exposing response bodies", () => {
    expect(
      safeGenericPaidFunnelPublishFailure(
        new CloudflareApiError("bulk secret update", 403, 10000)
      )
    ).toBe("Cloudflare bulk secret update failed with HTTP 403 (code 10000).");
  });

  it("defers organization-secret verification when a repository token cannot read org metadata", async () => {
    const getOrganizationActionsSecret = vi
      .fn()
      .mockRejectedValue(
        new GitHubApiError("organization Actions secret lookup", 403)
      );

    await expect(
      preflightGeneratedRepositoryActionsSecrets({
        github: { getOrganizationActionsSecret },
        organization: "increase-roas",
        signal: new AbortController().signal,
      })
    ).resolves.toBeUndefined();
    expect(getOrganizationActionsSecret).toHaveBeenCalledTimes(2);
  });

  it("still fails closed when an organization Actions secret is proven absent", async () => {
    const getOrganizationActionsSecret = vi.fn().mockResolvedValue(null);

    await expect(
      preflightGeneratedRepositoryActionsSecrets({
        github: { getOrganizationActionsSecret },
        organization: "increase-roas",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it("creates one new workflow attempt and never repeats repository, D1, or source work", async () => {
    const harness = inMemoryDependencies(jobFixture());

    const failed = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      workflowRunId: "100",
      workflowStatus: "failure",
      dispatchRequestedAt: null,
    });

    const dispatched = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7, retryFailed: true },
      harness.deps
    );
    expect(dispatched).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
    });
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(1);

    const reconciled = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );
    expect(reconciled).toMatchObject({
      status: "pending",
      step: "monitor_workflow",
      workflowRunId: "101",
    });
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(harness.findWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        afterWorkflowRunId: "100",
        sourceSha: "source-sha",
      })
    );
    expect(harness.getWorkflowRun).toHaveBeenCalledTimes(1);
    expect(harness.deps.external.ensureRepository).not.toHaveBeenCalled();
    expect(harness.deps.external.ensureResources).not.toHaveBeenCalled();
    expect(harness.deps.external.commitSource).not.toHaveBeenCalled();
    expect(harness.current().commitSha).toBe("source-sha");
  });

  it("fails closed before committing when persisted resource identity is missing", async () => {
    const harness = inMemoryDependencies({
      ...jobFixture(),
      step: "commit_source",
      provisionedResources: null,
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
    });

    const result = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );

    expect(result).toMatchObject({
      status: "failed",
      step: "commit_source",
      error:
        "Provisioned paid funnel resources are missing or do not match the publish job.",
    });
    expect(harness.deps.loadMaterial).not.toHaveBeenCalled();
    expect(harness.deps.external.commitSource).not.toHaveBeenCalled();
  });

  it("clears a dispatch marker after a proven no-effect failure so Retry can dispatch", async () => {
    const harness = inMemoryDependencies({
      ...jobFixture(),
      step: "dispatch_workflow",
      status: "pending",
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
    });
    harness.dispatchWorkflow
      .mockRejectedValueOnce(
        new PublisherProvenNoEffectError("dispatch rejected")
      )
      .mockResolvedValueOnce(undefined);

    const failed = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      dispatchRequestedAt: null,
    });

    await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7, retryFailed: true },
      harness.deps
    );
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(2);
  });

  it("retains a dispatch marker after an ambiguous failure", async () => {
    const harness = inMemoryDependencies({
      ...jobFixture(),
      step: "dispatch_workflow",
      status: "pending",
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
    });
    harness.dispatchWorkflow.mockRejectedValueOnce(
      new Error("connection ended")
    );

    const failed = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      dispatchRequestedAt: expect.any(Date),
    });
  });

  it("clears a repository-create marker after a proven no-effect failure", async () => {
    const harness = inMemoryDependencies({
      ...jobFixture(),
      step: "create_repository",
      status: "pending",
      repositoryCreateRequestedAt: null,
      repositoryId: null,
      repositoryFullName: null,
      repositoryUrl: null,
      defaultBranch: null,
      provisionedResources: null,
      commitSha: null,
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
    });
    harness.deps.external.ensureRepository = vi.fn(async input => {
      await input.markCreateRequested();
      throw new PublisherProvenNoEffectError("repository rejected");
    });

    const failed = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "create_repository",
    });
    expect(harness.current().repositoryCreateRequestedAt).toBeNull();
  });

  it("uses one encrypted snapshot for source and secret steps", async () => {
    const previousKey = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-publisher-snapshot-key";
    try {
      const materialSnapshotEncrypted = sealGenericPaidFunnelMaterialSnapshot({
        files: [{ path: "src/pages/index.astro", content: "release source" }],
        runtimeVars: { META_PIXEL_ID: "123456789012345" },
        runtimeSecrets: { META_CAPI_ACCESS_TOKEN: "release-secret" },
      });
      const commitHarness = inMemoryDependencies({
        ...jobFixture(),
        step: "commit_source",
        materialSnapshotEncrypted,
        dispatchRequestedAt: null,
        workflowRunId: null,
        workflowStatus: null,
      });
      const commitSource = vi
        .fn()
        .mockResolvedValue({ commitSha: "snapshot-sha" });
      commitHarness.deps.external.commitSource = commitSource;
      await advanceGenericPaidFunnelPublish(
        { clientId: 5, funnelId: 7 },
        commitHarness.deps
      );
      expect(commitSource).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [{ path: "src/pages/index.astro", content: "release source" }],
          runtimeVars: { META_PIXEL_ID: "123456789012345" },
        })
      );
      expect(commitHarness.deps.loadMaterial).not.toHaveBeenCalled();

      const secretHarness = inMemoryDependencies({
        ...jobFixture(),
        step: "patch_runtime_secrets",
        materialSnapshotEncrypted,
        workflowStatus: "success",
      });
      const patchRuntimeSecrets = vi.fn().mockResolvedValue(undefined);
      secretHarness.deps.external.patchRuntimeSecrets = patchRuntimeSecrets;
      await advanceGenericPaidFunnelPublish(
        { clientId: 5, funnelId: 7 },
        secretHarness.deps
      );
      expect(patchRuntimeSecrets).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeSecrets: { META_CAPI_ACCESS_TOKEN: "release-secret" },
        })
      );
      expect(secretHarness.deps.loadMaterial).not.toHaveBeenCalled();
    } finally {
      if (previousKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = previousKey;
    }
  });

  it("preflights deployment credentials before loading material or creating a job", async () => {
    const harness = inMemoryDependencies(jobFixture());
    const failure = new Error("credentials unavailable");
    vi.mocked(
      harness.deps.external.preflightDeploymentCredentials
    ).mockRejectedValue(failure);

    await expect(
      startGenericPaidFunnelPublish({ clientId: 5, funnelId: 7 }, harness.deps)
    ).rejects.toBe(failure);
    expect(harness.deps.loadMaterial).not.toHaveBeenCalled();
    expect(harness.deps.store.start).not.toHaveBeenCalled();
  });
});

describe("generic Astro managed-file manifest", () => {
  it("deletes stale publisher-owned files and leaves unmanaged files alone", () => {
    const previousKey = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-managed-files-key";
    try {
      const previous = genericPaidFunnelManagedFilePlan(
        ["src/pages/index.astro", "src/pages/old.astro", "package.json"],
        null
      );
      const plan = genericPaidFunnelManagedFilePlan(
        ["src/pages/index.astro", "package.json"],
        previous.manifestContent
      );
      expect(plan.deletePaths).toEqual(["src/pages/old.astro"]);
      expect(JSON.parse(decryptSetupValue(plan.manifestContent))).toEqual({
        version: 1,
        paths: ["package.json", "src/pages/index.astro"],
      });
    } finally {
      if (previousKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = previousKey;
    }
  });

  it("never infers deletions when a prior publisher manifest is absent", () => {
    const previousKey = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-managed-files-key";
    try {
      expect(
        genericPaidFunnelManagedFilePlan(["src/pages/index.astro"], null)
          .deletePaths
      ).toEqual([]);
    } finally {
      if (previousKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = previousKey;
    }
  });

  it("refuses a customer-edited manifest instead of deleting untrusted paths", () => {
    const previousKey = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-managed-files-key";
    try {
      expect(() =>
        genericPaidFunnelManagedFilePlan(
          ["src/pages/index.astro"],
          JSON.stringify({ version: 1, paths: ["customer-notes.txt"] })
        )
      ).toThrow(/manual attention/i);
    } finally {
      if (previousKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = previousKey;
    }
  });
});
