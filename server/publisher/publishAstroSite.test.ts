import { describe, expect, it, vi } from "vitest";
import type { AstroSitePublishJob, AstroSitePublishDependencies } from "./publishAstroSite";
import { advanceAstroSitePublish } from "./publishAstroSite";

function jobFixture(): AstroSitePublishJob {
  const now = new Date("2026-08-18T12:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: 5,
    externalSiteId: "astro-site-client-5",
    templateKey: "htl-astro-website",
    templateRepo: "increaseroasir/32-htl-website-template-astrobuild",
    contractVersion: 1,
    resourceName: "website-north-star-5",
    repositoryName: "website-north-star-5",
    workerName: "website-north-star-5",
    d1DatabaseName: "website-north-star-5-inventory",
    r2BucketName: "website-north-star-5-images",
    step: "monitor_workflow",
    status: "pending",
    repositoryId: "42",
    repositoryFullName: "increase-roas/website-north-star-5",
    repositoryUrl: "https://github.com/increase-roas/website-north-star-5",
    defaultBranch: "main",
    repositoryCreateRequestedAt: now,
    d1DatabaseId: "d1-id",
    r2BucketId: "r2-id",
    r2PublicUrl: "https://pub-example.r2.dev",
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

function inMemoryDependencies(initial: AstroSitePublishJob) {
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

  const deps: AstroSitePublishDependencies = {
    now: () => new Date(++clock),
    createLeaseToken: () => "22222222-2222-4222-8222-222222222222",
    leaseDurationMs: 30_000,
    externalTimeoutMs: 5_000,
    loadMaterial: vi.fn().mockResolvedValue({
      generatedConfig: "export const rawClientConfig = {};",
      runtimeSecrets: {},
    }),
    external: {
      ensureRepository: unused,
      ensureD1Database: unused,
      ensureR2Bucket: unused,
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

describe("Astro website workflow Retry", () => {
  it("creates one new workflow attempt and retains the failed run as the reconciliation cursor", async () => {
    const harness = inMemoryDependencies(jobFixture());

    const failed = await advanceAstroSitePublish({ clientId: 5 }, harness.deps);
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      workflowRunId: "100",
      workflowStatus: "failure",
      dispatchRequestedAt: null,
    });

    const dispatched = await advanceAstroSitePublish(
      { clientId: 5, retryFailed: true },
      harness.deps,
    );
    expect(dispatched).toMatchObject({ status: "pending", step: "dispatch_workflow" });
    expect(harness.dispatchWorkflow).toHaveBeenCalledTimes(1);

    const reconciled = await advanceAstroSitePublish({ clientId: 5 }, harness.deps);
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
    expect(harness.deps.external.ensureD1Database).not.toHaveBeenCalled();
    expect(harness.deps.external.ensureR2Bucket).not.toHaveBeenCalled();
    expect(harness.deps.external.commitSource).not.toHaveBeenCalled();
    expect(harness.current().commitSha).toBe("source-sha");
  });
});
