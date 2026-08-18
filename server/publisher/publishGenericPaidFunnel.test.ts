import { describe, expect, it, vi } from "vitest";
import type {
  GenericPaidFunnelPublishDependencies,
  GenericPaidFunnelPublishJob,
} from "./publishGenericPaidFunnel";
import { advanceGenericPaidFunnelPublish } from "./publishGenericPaidFunnel";

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
      d1: [{ binding: "FUNNEL_DB", name: "funnel-north-star-7-1", id: "d1-id" }],
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
  const unused = vi.fn().mockRejectedValue(new Error("unexpected external call"));
  const deps: GenericPaidFunnelPublishDependencies = {
    now: () => new Date(++clock),
    createLeaseToken: () => "22222222-2222-4222-8222-222222222222",
    leaseDurationMs: 30_000,
    externalTimeoutMs: 5_000,
    loadMaterial: vi.fn().mockRejectedValue(new Error("unexpected material load")),
    external: {
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
        if (job.status === "published" || (job.status === "failed" && !input.allowFailed)) return null;
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
      markRepositoryCreateRequested: vi.fn(),
      markDispatchRequested: async input => {
        if (job.dispatchRequestedAt || job.leaseToken !== input.leaseToken) return null;
        job = { ...job, dispatchRequestedAt: input.requestedAt, updatedAt: input.requestedAt };
        return { ...job };
      },
      complete: async input => {
        if (job.leaseToken !== input.leaseToken || job.step !== input.expectedStep) return null;
        job = {
          ...job,
          ...input.completion.values,
          step: input.completion.nextStep,
          status: input.completion.nextStep === "published" ? "published" : "pending",
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
  return { deps, dispatchWorkflow, findWorkflowRun, getWorkflowRun, current: () => job };
}

describe("generic Astro paid funnel workflow Retry", () => {
  it("creates one new workflow attempt and never repeats repository, D1, or source work", async () => {
    const harness = inMemoryDependencies(jobFixture());

    const failed = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps,
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
      harness.deps,
    );
    expect(dispatched).toMatchObject({ status: "pending", step: "dispatch_workflow" });
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(1);

    const reconciled = await advanceGenericPaidFunnelPublish(
      { clientId: 5, funnelId: 7 },
      harness.deps,
    );
    expect(reconciled).toMatchObject({
      status: "pending",
      step: "monitor_workflow",
      workflowRunId: "101",
    });
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(harness.findWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({ afterWorkflowRunId: "100", sourceSha: "source-sha" }),
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
      harness.deps,
    );

    expect(result).toMatchObject({
      status: "failed",
      step: "commit_source",
      error: "Paid funnel publish step failed. Retry to resume.",
    });
    expect(harness.deps.loadMaterial).not.toHaveBeenCalled();
    expect(harness.deps.external.commitSource).not.toHaveBeenCalled();
  });
});
