import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSimpleFormStoredRecord } from "../../shared/simpleFormConfig";
import {
  advanceSimpleFormPublish,
  startSimpleFormPublish,
  toSimpleFormPublishStatus,
  type FunnelPublishJob,
  type PublishStepCompletion,
  type SimpleFormPublishDependencies,
  type SimpleFormPublishExternal,
  type SimpleFormPublishStore,
} from "./publishSimpleForm";

const FIRST_NOW = new Date("2026-08-17T18:00:00.000Z");

function readyMaterial() {
  const record = buildSimpleFormStoredRecord({
    businessName: "Northland Spas",
    slug: "northland-simple-form",
    phone: "+17015551234",
  });
  record.config.meta.pixelId = "123456789012345";
  record.config.serviceAreaZipCodes = ["58701"];
  return {
    config: record.config,
    runtimeSecrets: {
      META_CAPI_ACCESS_TOKEN: "server-only-meta-token",
      META_TEST_EVENT_CODE: null,
      GHL_WEBHOOK_URL: "https://services.leadconnectorhq.com/hooks/example",
      CRM_CALLBACK_SECRET: "server-only-callback-secret",
      SUBMISSION_ALERT_WEBHOOK_URL: null,
    },
  };
}

class MemoryPublishStore implements SimpleFormPublishStore {
  job: FunnelPublishJob | null = null;

  async start(input: Parameters<SimpleFormPublishStore["start"]>[0]) {
    if (this.job) return this.job;
    this.job = {
      id: "publish-11",
      clientId: input.clientId,
      funnelId: input.funnelId,
      externalFunnelId: input.externalFunnelId,
      resourceName: input.resourceName,
      repositoryName: input.repositoryName,
      workerName: input.workerName,
      step: "create_repository",
      status: "pending",
      repositoryId: null,
      repositoryFullName: null,
      repositoryUrl: null,
      defaultBranch: null,
      kvNamespaceId: null,
      d1DatabaseId: null,
      primaryQueueId: null,
      deadLetterQueueId: null,
      commitSha: null,
      liveUrl: null,
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
      workflowCheckedAt: null,
      runtimeSecretsPatchedAt: null,
      leaseToken: null,
      leaseUntil: null,
      lastError: null,
      attemptCount: 0,
      completedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    return this.job;
  }

  async get(clientId: number, funnelId: number) {
    return this.job?.clientId === clientId && this.job.funnelId === funnelId
      ? this.job
      : null;
  }

  async claim(input: Parameters<SimpleFormPublishStore["claim"]>[0]) {
    const job = this.job;
    if (
      !job ||
      job.clientId !== input.clientId ||
      job.funnelId !== input.funnelId ||
      job.step === "published"
    ) {
      return null;
    }
    if (job.leaseUntil && job.leaseUntil > input.now) return null;
    this.job = {
      ...job,
      status: "running",
      leaseToken: input.leaseToken,
      leaseUntil: input.leaseUntil,
      lastError: null,
      attemptCount: job.attemptCount + 1,
      updatedAt: input.now,
    };
    return this.job;
  }

  async markDispatchRequested(
    input: Parameters<SimpleFormPublishStore["markDispatchRequested"]>[0]
  ) {
    const job = this.job;
    if (!job || job.id !== input.jobId || job.leaseToken !== input.leaseToken) {
      return null;
    }
    this.job = {
      ...job,
      dispatchRequestedAt: input.requestedAt,
      updatedAt: input.requestedAt,
    };
    return this.job;
  }

  async complete(input: Parameters<SimpleFormPublishStore["complete"]>[0]) {
    const job = this.job;
    if (
      !job ||
      job.id !== input.jobId ||
      job.leaseToken !== input.leaseToken ||
      job.step !== input.expectedStep
    ) {
      return null;
    }
    this.job = applyCompletion(job, input.completion, input.now);
    return this.job;
  }

  async fail(input: Parameters<SimpleFormPublishStore["fail"]>[0]) {
    const job = this.job;
    if (!job || job.id !== input.jobId || job.leaseToken !== input.leaseToken) {
      return null;
    }
    this.job = {
      ...job,
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: input.message,
      updatedAt: input.now,
    };
    return this.job;
  }
}

function applyCompletion(
  job: FunnelPublishJob,
  completion: PublishStepCompletion,
  now: Date
): FunnelPublishJob {
  const base = {
    ...job,
    status:
      completion.nextStep === "published"
        ? ("published" as const)
        : ("pending" as const),
    step: completion.nextStep,
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    updatedAt: now,
    completedAt: completion.nextStep === "published" ? now : job.completedAt,
  };
  return { ...base, ...completion.values };
}

function externalMocks(): SimpleFormPublishExternal {
  return {
    ensureRepository: vi.fn().mockResolvedValue({
      repositoryId: "repo-101",
      repositoryFullName: "launchpad-sites/simple-form-northland-11",
      repositoryUrl:
        "https://github.com/launchpad-sites/simple-form-northland-11",
      defaultBranch: "main",
    }),
    ensureKvNamespace: vi.fn().mockResolvedValue({
      kvNamespaceId: "kv-201",
    }),
    ensureD1Database: vi.fn().mockResolvedValue({
      d1DatabaseId: "d1-301",
    }),
    ensureQueues: vi.fn().mockResolvedValue({
      primaryQueueId: "queue-401",
      deadLetterQueueId: "queue-402",
    }),
    commitSource: vi.fn().mockResolvedValue({ commitSha: "abc123" }),
    dispatchWorkflow: vi.fn().mockResolvedValue({
      workflowRunId: "run-501",
      status: "queued",
    }),
    getWorkflowRun: vi.fn().mockResolvedValue({
      status: "completed",
      conclusion: "success",
    }),
    patchRuntimeSecrets: vi.fn().mockResolvedValue(undefined),
    getWorkersDevStatus: vi.fn().mockResolvedValue({
      liveUrl: "https://simple-form-northland-11.workers.dev",
    }),
  };
}

function dependencies(
  store: MemoryPublishStore,
  external: SimpleFormPublishExternal = externalMocks(),
  options: {
    now?: () => Date;
    externalTimeoutMs?: number;
  } = {}
): SimpleFormPublishDependencies {
  return {
    store,
    external,
    loadMaterial: vi.fn().mockResolvedValue(readyMaterial()),
    now: options.now ?? (() => FIRST_NOW),
    createLeaseToken: () => "lease-1",
    leaseDurationMs: 30_000,
    externalTimeoutMs: options.externalTimeoutMs ?? 100,
    repositoryGenerationTimeoutMs: options.externalTimeoutMs ?? 100,
  };
}

async function started(
  store: MemoryPublishStore,
  deps: SimpleFormPublishDependencies
) {
  return startSimpleFormPublish(
    { clientId: 5, funnelId: 11, clientShortName: "Northland Spas" },
    deps
  );
}

describe("Simple Form publish state machine", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("uses deterministic globally unique names and one job per funnel", async () => {
    const store = new MemoryPublishStore();
    const deps = dependencies(store);

    const first = await started(store, deps);
    const duplicate = await started(store, deps);

    expect(first.id).toBe(duplicate.id);
    expect(first.externalFunnelId).toBe("simple-form-funnel-11");
    expect(first.repositoryName).toBe("simple-form-northland-spas-11");
    expect(first.workerName).toBe("simple-form-northland-spas-11");
    expect(first.progress).toEqual({ completed: 0, total: 9 });
  });

  it("performs exactly one external step per advance and persists each result", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    const deps = dependencies(store, external);
    await started(store, deps);

    const expectedSteps = [
      "ensure_kv_namespace",
      "ensure_d1_database",
      "ensure_queues",
      "commit_source",
      "dispatch_workflow",
      "monitor_workflow",
      "patch_runtime_secrets",
      "get_live_url",
      "published",
    ] as const;
    for (const expectedStep of expectedSteps) {
      const callsBefore = Object.values(external).reduce(
        (total, mock) => total + vi.mocked(mock).mock.calls.length,
        0
      );
      const status = await advanceSimpleFormPublish(
        { clientId: 5, funnelId: 11 },
        deps
      );
      const callsAfter = Object.values(external).reduce(
        (total, mock) => total + vi.mocked(mock).mock.calls.length,
        0
      );
      expect(callsAfter - callsBefore).toBe(1);
      expect(status.step).toBe(expectedStep);
    }

    expect(store.job).toMatchObject({
      repositoryId: "repo-101",
      kvNamespaceId: "kv-201",
      d1DatabaseId: "d1-301",
      primaryQueueId: "queue-401",
      deadLetterQueueId: "queue-402",
      commitSha: "abc123",
      dispatchRequestedAt: FIRST_NOW,
      workflowRunId: "run-501",
      status: "published",
      step: "published",
    });
    expect(external.patchRuntimeSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeSecrets: expect.objectContaining({
          META_CAPI_ACCESS_TOKEN: "server-only-meta-token",
          CRM_CALLBACK_SECRET: "server-only-callback-secret",
        }),
      })
    );
    expect(external.commitSource).toHaveBeenCalledWith(
      expect.objectContaining({
        kvNamespaceId: "kv-201",
        d1DatabaseId: "d1-301",
        primaryQueueName: "simple-form-northland-spas-11-retries",
        deadLetterQueueName: "simple-form-northland-spas-11-dead",
      })
    );
  });

  it("allows only one concurrent advance to hold the lease", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    const deps = dependencies(store, external);
    await started(store, deps);

    const statuses = await Promise.all([
      advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps),
      advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps),
    ]);

    expect(external.ensureRepository).toHaveBeenCalledTimes(1);
    expect(statuses.some(status => status.step === "ensure_kv_namespace")).toBe(
      true
    );
  });

  it("reclaims an expired lease but not an active lease", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    let now = FIRST_NOW;
    const deps = dependencies(store, external, { now: () => now });
    await started(store, deps);
    if (!store.job) throw new Error("Expected publish job.");
    store.job = {
      ...store.job,
      leaseToken: "other-lease",
      leaseUntil: new Date(FIRST_NOW.getTime() + 1_000),
    };

    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    expect(external.ensureRepository).not.toHaveBeenCalled();

    now = new Date(FIRST_NOW.getTime() + 1_001);
    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);
  });

  it("times out a bounded call and resumes from the same persisted step", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.ensureRepository).mockImplementationOnce(
      () => new Promise(() => undefined)
    );
    const deps = dependencies(store, external, { externalTimeoutMs: 5 });
    await started(store, deps);

    const failed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "create_repository",
      error: "Repository creation timed out.",
    });
    expect(store.job?.leaseToken).toBeNull();

    const resumed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(resumed.step).toBe("ensure_kv_namespace");
    expect(external.ensureRepository).toHaveBeenCalledTimes(2);
  });

  it("resumes after persisted repository state without creating a duplicate", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    const deps = dependencies(store, external);
    await started(store, deps);
    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);

    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);

    expect(external.ensureRepository).toHaveBeenCalledTimes(1);
    expect(external.ensureKvNamespace).toHaveBeenCalledTimes(1);
    expect(external.commitSource).not.toHaveBeenCalled();
    expect(store.job?.repositoryId).toBe("repo-101");
    expect(store.job?.kvNamespaceId).toBe("kv-201");
  });

  it("accepts only the MVP workers.dev live URL", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.getWorkersDevStatus).mockResolvedValueOnce({
      liveUrl: "https://custom.example.com",
    });
    const deps = dependencies(store, external);
    await started(store, deps);
    for (let index = 0; index < 8; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }

    const status = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(status).toMatchObject({
      status: "failed",
      step: "get_live_url",
      error: "workers.dev status lookup failed. Retry to resume.",
    });
    expect(status.liveUrl).toBeNull();
  });

  it("persists the run id returned directly by a retried dispatch", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.dispatchWorkflow).mockImplementationOnce(
      () => new Promise(() => undefined)
    );
    const deps = dependencies(store, external, { externalTimeoutMs: 5 });
    await started(store, deps);
    for (let index = 0; index < 5; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }

    const failed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(failed.step).toBe("dispatch_workflow");
    expect(store.job?.dispatchRequestedAt).toEqual(FIRST_NOW);

    const retried = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(retried.step).toBe("monitor_workflow");
    expect(retried.workflowRunId).toBe("run-501");
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(2);
  });

  it("never exposes runtime secrets or lease tokens in browser status", async () => {
    const store = new MemoryPublishStore();
    const deps = dependencies(store);
    await started(store, deps);
    if (!store.job) throw new Error("Expected publish job.");
    store.job = {
      ...store.job,
      leaseToken: "private-lease",
      lastError: "Safe summary",
    };

    const serialized = JSON.stringify(toSimpleFormPublishStatus(store.job));

    expect(serialized).not.toContain("server-only");
    expect(serialized).not.toContain("private-lease");
    expect(serialized).toContain("Safe summary");
  });
});
