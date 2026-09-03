import { describe, expect, it, vi } from "vitest";
import type { AstroSitePreviewJob, AstroSitePreviewDependencies } from "./previewAstroSite";
import { advanceAstroSitePreview } from "./previewAstroSite";
import { protectPreviewMaterialSnapshot } from "./previewMaterial";

function jobFixture(): AstroSitePreviewJob {
  const now = new Date("2026-09-02T12:00:00.000Z");
  process.env.SECRETS_ENCRYPTION_KEY = "test-only-preview-pipeline-key";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: 5,
    externalSiteId: "astro-site-preview-client-5",
    templateKey: "htl-astro-website",
    templateRepo: "increase-roas/32-htl-website-template-astrobuild",
    contractVersion: 1,
    templateSha: "2ced3065460a31a497df96b214e2a0f0ace27f3d",
    clientRevision: 27,
    resourceName: "website-abc-hot-tubs-5",
    repositoryName: "website-abc-hot-tubs-5",
    workerName: "website-abc-hot-tubs-5-preview",
    d1DatabaseName: "website-abc-hot-tubs-5-preview-inventory",
    r2BucketName: "website-abc-hot-tubs-5-images",
    step: "commit_source",
    status: "pending",
    repositoryId: "42",
    repositoryFullName: "increase-roas/website-abc-hot-tubs-5",
    repositoryUrl: "https://github.com/increase-roas/website-abc-hot-tubs-5",
    defaultBranch: "main",
    repositoryCreateRequestedAt: now,
    d1DatabaseId: "d1-preview",
    r2BucketId: "r2-id",
    r2PublicUrl: "https://pub-example.r2.dev",
    commitSha: null,
    previewUrl: null,
    dispatchRequestedAt: null,
    workflowRunId: null,
    workflowStatus: null,
    workflowCheckedAt: null,
    runtimeSecretsPatchedAt: null,
    materialSnapshotEncrypted: protectPreviewMaterialSnapshot({
      generatedConfig: 'export const rawClientConfig = {"identity":{"name":"Frozen ABC"}};',
      runtimeSecrets: { ENVIRONMENT: "preview", ADMIN_PASSWORD: "snap" },
      clientRevision: 27,
      warnings: [{ code: "favicon", message: "Favicon is not provided." }],
    }),
    warnings: [{ code: "favicon", message: "Favicon is not provided." }],
    errorCode: null,
    approvedSha: null,
    approvedAt: null,
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    attemptCount: 1,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function inMemoryDependencies(initial: AstroSitePreviewJob) {
  let job = { ...initial };
  let clock = initial.updatedAt.getTime();
  const unused = vi.fn().mockRejectedValue(new Error("unexpected external call"));
  const commitSource = vi.fn().mockResolvedValue({ commitSha: "9ef83ab672aaaaaaaaaaaaaaaaaaaaaaaaaa" });
  const verifyPreviewUrl = vi.fn().mockResolvedValue(undefined);
  const getWorkersDevStatus = vi.fn().mockResolvedValue({
    liveUrl: "https://website-abc-hot-tubs-5-preview.increase-roas.workers.dev",
  });

  const deps: AstroSitePreviewDependencies = {
    now: () => new Date(++clock),
    createLeaseToken: () => "22222222-2222-4222-8222-222222222222",
    leaseDurationMs: 30_000,
    externalTimeoutMs: 5_000,
    currentRevision: async () => 28,
    external: {
      ensureRepository: unused,
      ensureD1Database: unused,
      ensureR2Bucket: unused,
      ensureKvNamespace: unused,
      syncActionsSecrets: unused,
      commitSource,
      dispatchWorkflow: unused,
      findWorkflowRun: unused,
      getWorkflowRun: unused,
      patchRuntimeSecrets: unused,
      getWorkersDevStatus,
      verifyPreviewUrl,
    },
    store: {
      start: vi.fn(),
      getLatest: async () => ({ ...job }),
      getById: async () => ({ ...job }),
      listHistory: async () => [{ ...job }],
      claim: async input => {
        if (job.status === "ready" || (job.status === "failed" && !input.allowFailed)) return null;
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
      markDispatchRequested: vi.fn(),
      complete: async input => {
        if (job.leaseToken !== input.leaseToken || job.step !== input.expectedStep) return null;
        job = {
          ...job,
          ...input.completion.values,
          step: input.completion.nextStep,
          status: input.completion.nextStep === "ready" ? "ready" : "pending",
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
          errorCode: input.errorCode ?? null,
          leaseToken: null,
          leaseUntil: null,
          lastError: input.message,
          updatedAt: input.now,
        };
        return { ...job };
      },
      approve: async input => {
        job = { ...job, approvedSha: input.approvedSha, approvedAt: input.now };
        return { ...job };
      },
    },
  };
  return { deps, commitSource, verifyPreviewUrl, getWorkersDevStatus, current: () => job };
}

describe("Astro website preview pipeline", () => {
  it("commits the frozen snapshot instead of live client edits", async () => {
    const harness = inMemoryDependencies(jobFixture());
    const ensureKvNamespace = vi.fn().mockResolvedValue({
      kvNamespaceId: "8d78d85f7f7a4e07bccce07a141ec6ac",
    });
    harness.deps.external.ensureKvNamespace = ensureKvNamespace;
    const advanced = await advanceAstroSitePreview({ jobId: harness.current().id }, harness.deps);
    expect(ensureKvNamespace).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "website-abc-hot-tubs-5-preview-session",
      }),
    );
    expect(harness.commitSource).toHaveBeenCalledWith(
      expect.objectContaining({
        generatedConfig: 'export const rawClientConfig = {"identity":{"name":"Frozen ABC"}};',
        clientRevision: 27,
        workerName: "website-abc-hot-tubs-5-preview",
        sessionKvNamespaceId: "8d78d85f7f7a4e07bccce07a141ec6ac",
      }),
    );
    expect(advanced).toMatchObject({
      step: "dispatch_workflow",
      clientRevision: 27,
      currentRevision: 28,
      stale: true,
      commitSha: "9ef83ab672aaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("marks ready only after the preview URL responds", async () => {
    const initial = jobFixture();
    initial.step = "verify_preview";
    initial.commitSha = "9ef83ab672aaaaaaaaaaaaaaaaaaaaaaaaaa";
    const harness = inMemoryDependencies(initial);
    const ready = await advanceAstroSitePreview({ jobId: initial.id }, harness.deps);
    expect(harness.getWorkersDevStatus).toHaveBeenCalledWith(
      expect.objectContaining({ workerName: "website-abc-hot-tubs-5-preview" }),
    );
    expect(harness.verifyPreviewUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://website-abc-hot-tubs-5-preview.increase-roas.workers.dev",
      }),
    );
    expect(ready).toMatchObject({
      status: "ready",
      step: "ready",
      previewUrl: "https://website-abc-hot-tubs-5-preview.increase-roas.workers.dev",
    });
  });
});
