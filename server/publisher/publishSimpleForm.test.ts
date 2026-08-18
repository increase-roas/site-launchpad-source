import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSimpleFormStoredRecord } from "../../shared/simpleFormConfig";
import {
  advanceSimpleFormPublish,
  publisherCloudflareResourceNames,
  startSimpleFormPublish,
  toSimpleFormPublishStatus,
  type FunnelPublishJob,
  type PublishStepCompletion,
  type SimpleFormPublishDependencies,
  type SimpleFormPublishExternal,
  type SimpleFormPublishStore,
} from "./publishSimpleForm";

const FIRST_NOW = new Date("2026-08-17T18:00:00.000Z");
const PERSISTED_SOURCE_SHA =
  "0123456789abcdef0123456789abcdef01234567";
const EXPECTED_WORKFLOW_TITLE =
  `Deploy publish-11 ${PERSISTED_SOURCE_SHA}`;

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
      GHL_API_KEY: "server-only-ghl-key",
      GHL_LOCATION_ID: "location-123",
      GOOGLE_SHEETS_ID: "sheet-123",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      META_PIXEL_ID: "123456789012345",
      META_CAPI_ACCESS_TOKEN: "server-only-meta-token",
      STAGE_WEBHOOK_SECRET: "server-only-stage-secret",
      ALERT_WEBHOOK_URL: null,
    },
  };
}

class MemoryPublishStore implements SimpleFormPublishStore {
  job: FunnelPublishJob | null = null;
  renewalAttempts = 0;
  completionAttempts = 0;

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
      repositoryCreateRequestedAt: null,
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

  async renewLease(input: {
    jobId: string;
    leaseToken: string;
    leaseUntil: Date;
    now: Date;
  }) {
    this.renewalAttempts += 1;
    const job = this.job;
    if (!job || job.id !== input.jobId || job.leaseToken !== input.leaseToken) {
      return false;
    }
    this.job = {
      ...job,
      leaseUntil: input.leaseUntil,
      updatedAt: input.now,
    };
    return true;
  }

  async markRepositoryCreateRequested(
    input: Parameters<
      SimpleFormPublishStore["markRepositoryCreateRequested"]
    >[0]
  ) {
    const job = this.job;
    if (
      !job ||
      job.id !== input.jobId ||
      job.leaseToken !== input.leaseToken ||
      job.step !== "create_repository" ||
      job.repositoryCreateRequestedAt !== null
    ) {
      return null;
    }
    this.job = {
      ...job,
      repositoryCreateRequestedAt: input.requestedAt,
      updatedAt: input.requestedAt,
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
    this.completionAttempts += 1;
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
      ...(input.resumeStep ? { step: input.resumeStep } : {}),
      ...(input.values ?? {}),
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
    ensureRepository: vi.fn().mockImplementation(async input => {
      if (input.allowCreate) await input.markCreateRequested();
      return {
        repositoryId: "repo-101",
        repositoryFullName: "launchpad-sites/simple-form-northland-11",
        repositoryUrl:
          "https://github.com/launchpad-sites/simple-form-northland-11",
        defaultBranch: "main",
      };
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
    commitSource: vi.fn().mockResolvedValue({
      commitSha: PERSISTED_SOURCE_SHA,
    }),
    dispatchWorkflow: vi.fn().mockResolvedValue(undefined),
    findWorkflowRun: vi.fn().mockResolvedValue({
      workflowRunId: "run-501",
      status: "queued",
      conclusion: null,
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    }),
    getWorkflowRun: vi.fn().mockResolvedValue({
      status: "completed",
      conclusion: "success",
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
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
    repositoryGenerationTimeoutMs?: number;
    leaseDurationMs?: number;
  } = {}
): SimpleFormPublishDependencies {
  return {
    store,
    external,
    loadMaterial: vi.fn().mockResolvedValue(readyMaterial()),
    now: options.now ?? (() => FIRST_NOW),
    createLeaseToken: () => "lease-1",
    leaseDurationMs: options.leaseDurationMs ?? 30_000,
    externalTimeoutMs: options.externalTimeoutMs ?? 100,
    repositoryGenerationTimeoutMs:
      options.repositoryGenerationTimeoutMs ?? 100,
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
      repositoryCreateRequestedAt: FIRST_NOW,
      kvNamespaceId: "kv-201",
      d1DatabaseId: "d1-301",
      primaryQueueId: "queue-401",
      deadLetterQueueId: "queue-402",
      commitSha: PERSISTED_SOURCE_SHA,
      dispatchRequestedAt: FIRST_NOW,
      workflowRunId: "run-501",
      status: "published",
      step: "published",
    });
    expect(external.patchRuntimeSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeSecrets: expect.objectContaining({
          GHL_API_KEY: "server-only-ghl-key",
          META_CAPI_ACCESS_TOKEN: "server-only-meta-token",
          STAGE_WEBHOOK_SECRET: "server-only-stage-secret",
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
    expect(external.dispatchWorkflow).toHaveBeenCalledWith({
      repositoryFullName: "launchpad-sites/simple-form-northland-11",
      defaultBranch: "main",
      commitSha: PERSISTED_SOURCE_SHA,
      publishJobId: "publish-11",
      signal: expect.any(AbortSignal),
    });
    expect(external.findWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSha: PERSISTED_SOURCE_SHA,
        publishJobId: "publish-11",
      })
    );
  });

  it("shares one client D1 database while preserving per-funnel resources", () => {
    const first = publisherCloudflareResourceNames("northland-client-11", 11);
    const second = publisherCloudflareResourceNames("northland-client-12", 12);

    expect(first.d1DatabaseName).toBe("northland-client-db");
    expect(second.d1DatabaseName).toBe(first.d1DatabaseName);
    expect(second.kvNamespaceTitle).not.toBe(first.kvNamespaceTitle);
    expect(second.primaryQueueName).not.toBe(first.primaryQueueName);
    expect(second.deadLetterQueueName).not.toBe(first.deadLetterQueueName);
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

  it("derives repository create permission from durable intent, not attempts", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    const deps = dependencies(store, external);
    await started(store, deps);
    if (!store.job) throw new Error("Expected publish job.");
    store.job = {
      ...store.job,
      repositoryCreateRequestedAt: FIRST_NOW,
      attemptCount: 0,
    };

    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);

    expect(external.ensureRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCreate: false,
        markCreateRequested: expect.any(Function),
      })
    );
    expect(store.job).toMatchObject({
      repositoryCreateRequestedAt: FIRST_NOW,
      repositoryId: "repo-101",
      step: "ensure_kv_namespace",
    });
  });

  it("uses the repository generation deadline independently of other external calls", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.ensureRepository).mockImplementationOnce(
      async input => {
        await input.markCreateRequested();
        return await new Promise((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => reject(input.signal.reason),
            { once: true }
          );
        });
      }
    );
    const deps = dependencies(store, external, {
      externalTimeoutMs: 1_000,
      repositoryGenerationTimeoutMs: 5,
    });
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

  it("keeps the lease until an aborted external operation settles", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    let observedAbort!: () => void;
    const abortObserved = new Promise<void>(resolve => {
      observedAbort = resolve;
    });
    let settleCancellation!: () => void;
    const cancellationSettled = new Promise<void>(resolve => {
      settleCancellation = resolve;
    });
    vi.mocked(external.ensureRepository).mockImplementationOnce(
      async input => {
        await input.markCreateRequested();
        return await new Promise((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => {
              observedAbort();
              void cancellationSettled.then(() => reject(input.signal.reason));
            },
            { once: true }
          );
        });
      }
    );
    const deps = dependencies(store, external, {
      repositoryGenerationTimeoutMs: 5,
    });
    await started(store, deps);

    const advancing = advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    const firstOutcome = await Promise.race([
      abortObserved.then(() => "aborted" as const),
      advancing.then(() => "released" as const),
    ]);
    expect(firstOutcome).toBe("aborted");
    expect(store.job?.leaseToken).toBe("lease-1");

    const overlapping = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(overlapping.step).toBe("create_repository");
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);

    let released = false;
    void advancing.then(() => {
      released = true;
    });
    await Promise.resolve();
    expect(released).toBe(false);

    settleCancellation();
    const failed = await advancing;
    expect(failed.error).toBe("Repository creation timed out.");
    expect(store.job?.leaseToken).toBeNull();
  });

  it("uses a lease heartbeat until unresolved external work settles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST_NOW);
    const store = new MemoryPublishStore();
    const external = externalMocks();
    let settleCancellation!: () => void;
    const cancellationSettled = new Promise<void>(resolve => {
      settleCancellation = resolve;
    });
    vi.mocked(external.ensureRepository).mockImplementationOnce(
      async input => {
        await input.markCreateRequested();
        return await new Promise((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => {
              void cancellationSettled.then(() => reject(input.signal.reason));
            },
            { once: true }
          );
        });
      }
    );
    const deps = dependencies(store, external, {
      now: () => new Date(Date.now()),
      repositoryGenerationTimeoutMs: 5,
      leaseDurationMs: 30,
    });
    await started(store, deps);

    const advancing = advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31);
    expect(store.job?.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
    const overlapping = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(overlapping.step).toBe("create_repository");

    settleCancellation();
    const failed = await advancing;
    expect(failed).toMatchObject({
      status: "failed",
      step: "create_repository",
      error: "Repository creation timed out.",
    });
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);

    const renewalAttemptsAfterSettlement = store.renewalAttempts;
    expect(renewalAttemptsAfterSettlement).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(store.renewalAttempts).toBe(renewalAttemptsAfterSettlement);
  });

  it("skips heartbeat ticks while a lease renewal is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST_NOW);
    const store = new MemoryPublishStore();
    const external = externalMocks();
    let settleOperation!: (
      result: Awaited<ReturnType<SimpleFormPublishExternal["ensureRepository"]>>
    ) => void;
    vi.mocked(external.ensureRepository).mockImplementationOnce(async input => {
      await input.markCreateRequested();
      return await new Promise(resolve => {
        settleOperation = resolve;
      });
    });
    let settleFirstRenewal!: (renewed: boolean) => void;
    const renewLease = vi
      .spyOn(store, "renewLease")
      .mockImplementationOnce(
        async () =>
          await new Promise(resolve => {
            settleFirstRenewal = resolve;
          })
      );
    const deps = dependencies(store, external, {
      now: () => new Date(Date.now()),
      repositoryGenerationTimeoutMs: 1_000,
      leaseDurationMs: 30,
    });
    await started(store, deps);

    const advancing = advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(renewLease).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(90);
    expect(renewLease).toHaveBeenCalledTimes(1);

    settleFirstRenewal(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(renewLease).toHaveBeenCalledTimes(1);

    settleOperation({
      repositoryId: "repo-101",
      repositoryFullName: "launchpad-sites/simple-form-northland-11",
      repositoryUrl:
        "https://github.com/launchpad-sites/simple-form-northland-11",
      defaultBranch: "main",
    });
    await advancing;
  });

  it("aborts on token-guarded lease heartbeat loss without persisting success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST_NOW);
    const store = new MemoryPublishStore();
    const external = externalMocks();
    let settleOperation!: (
      result: Awaited<ReturnType<SimpleFormPublishExternal["ensureRepository"]>>
    ) => void;
    let operationAborted = false;
    vi.mocked(external.ensureRepository).mockImplementationOnce(
      async input => {
        await input.markCreateRequested();
        return await new Promise((resolve, reject) => {
          settleOperation = resolve;
          input.signal.addEventListener(
            "abort",
            () => {
              operationAborted = true;
              reject(input.signal.reason);
            },
            { once: true }
          );
        });
      }
    );
    const deps = dependencies(store, external, {
      now: () => new Date(Date.now()),
      externalTimeoutMs: 1_000,
      leaseDurationMs: 30,
    });
    await started(store, deps);

    const advancing = advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    await vi.advanceTimersByTimeAsync(0);
    if (!store.job) throw new Error("Expected publish job.");
    store.job = {
      ...store.job,
      leaseToken: "other-lease",
      leaseUntil: new Date(Date.now() + 30),
    };

    await vi.advanceTimersByTimeAsync(11);
    if (!operationAborted) {
      settleOperation({
        repositoryId: "repo-101",
        repositoryFullName: "launchpad-sites/simple-form-northland-11",
        repositoryUrl:
          "https://github.com/launchpad-sites/simple-form-northland-11",
        defaultBranch: "main",
      });
    }
    await advancing;

    expect(operationAborted).toBe(true);
    expect(store.renewalAttempts).toBeGreaterThan(0);
    expect(store.completionAttempts).toBe(0);
    expect(store.job).toMatchObject({
      step: "create_repository",
      repositoryId: null,
      leaseToken: "other-lease",
    });
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
    for (let index = 0; index < 9; index += 1) {
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

  it("reconciles a lost dispatch response without redispatching", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.dispatchWorkflow).mockImplementationOnce(
      input =>
        new Promise((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => reject(input.signal.reason),
            { once: true }
          );
        })
    );
    vi.mocked(external.findWorkflowRun).mockResolvedValueOnce({
      workflowRunId: "run-501",
      status: "queued",
      conclusion: null,
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    });
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

    const reconciled = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(reconciled.step).toBe("monitor_workflow");
    expect(reconciled.workflowRunId).toBe("run-501");
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(external.dispatchWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        publishJobId: "publish-11",
        commitSha: PERSISTED_SOURCE_SHA,
        signal: expect.any(AbortSignal),
      })
    );
    expect(external.findWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        publishJobId: "publish-11",
        sourceSha: PERSISTED_SOURCE_SHA,
        workflow: "deploy.yml",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("persists a successful dispatch and reconciles a delayed run without redispatching", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.findWorkflowRun)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        workflowRunId: "run-501",
        status: "queued",
        conclusion: null,
        headSha: "newer-default-branch-head",
        displayTitle: EXPECTED_WORKFLOW_TITLE,
      });
    const deps = dependencies(store, external);
    await started(store, deps);
    for (let index = 0; index < 5; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }

    const dispatched = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(dispatched).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
      dispatchRequestedAt: FIRST_NOW,
      workflowRunId: null,
    });
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(external.findWorkflowRun).not.toHaveBeenCalled();

    const waiting = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(waiting).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
      error: null,
      workflowRunId: null,
    });
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(external.findWorkflowRun).toHaveBeenCalledTimes(1);

    const reconciled = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(reconciled).toMatchObject({
      status: "pending",
      step: "monitor_workflow",
      workflowRunId: "run-501",
    });
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(external.findWorkflowRun).toHaveBeenCalledTimes(2);
  });

  it("requires manual attention only after the dispatch reconciliation window", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.findWorkflowRun).mockResolvedValue(null);
    let now = FIRST_NOW;
    const deps = dependencies(store, external, { now: () => now });
    await started(store, deps);
    for (let index = 0; index < 5; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }
    await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);

    now = new Date(FIRST_NOW.getTime() + 59_999);
    const waiting = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(waiting).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
      error: null,
    });

    now = new Date(FIRST_NOW.getTime() + 60_001);
    const failed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      error: expect.stringMatching(/manual attention/i),
    });
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(external.findWorkflowRun).toHaveBeenCalledTimes(2);
  });

  it("retries a correlated failed workflow from dispatch without recreating prior work", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.getWorkflowRun).mockResolvedValue({
      status: "completed",
      conclusion: "failure",
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    });
    const deps = dependencies(store, external);
    await started(store, deps);
    for (let index = 0; index < 7; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }

    const failed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );
    expect(failed).toMatchObject({
      status: "failed",
      step: "dispatch_workflow",
      dispatchRequestedAt: null,
      workflowRunId: "run-501",
      error: expect.stringMatching(/retry/i),
    });

    const retried = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(retried).toMatchObject({
      id: failed.id,
      status: "pending",
      step: "dispatch_workflow",
      dispatchRequestedAt: FIRST_NOW,
      workflowRunId: "run-501",
    });
    vi.mocked(external.findWorkflowRun).mockResolvedValueOnce({
      workflowRunId: "run-502",
      status: "queued",
      conclusion: null,
      headSha: "newer-default-branch-head",
      displayTitle: EXPECTED_WORKFLOW_TITLE,
    });

    const reconciledRetry = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(reconciledRetry).toMatchObject({
      id: failed.id,
      status: "pending",
      step: "monitor_workflow",
      workflowRunId: "run-502",
    });
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);
    expect(external.ensureKvNamespace).toHaveBeenCalledTimes(1);
    expect(external.ensureD1Database).toHaveBeenCalledTimes(1);
    expect(external.ensureQueues).toHaveBeenCalledTimes(1);
    expect(external.commitSource).toHaveBeenCalledTimes(1);
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(2);
    expect(external.getWorkflowRun).toHaveBeenCalledTimes(1);
    expect(external.findWorkflowRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ afterWorkflowRunId: "run-501" })
    );
  });

  it("transitions a legacy failed monitor job so one Retry can redispatch", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    const deps = dependencies(store, external);
    await started(store, deps);
    for (let index = 0; index < 7; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }
    if (!store.job) throw new Error("Expected publish job.");
    store.job = {
      ...store.job,
      status: "failed",
      step: "monitor_workflow",
      workflowStatus: "failure",
      lastError: "Legacy workflow failure",
    };

    const transitioned = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(transitioned).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
      dispatchRequestedAt: null,
      workflowRunId: "run-501",
      workflowStatus: "failure",
      error: null,
    });
    expect(external.getWorkflowRun).not.toHaveBeenCalled();

    const retried = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(retried).toMatchObject({
      status: "pending",
      step: "dispatch_workflow",
      dispatchRequestedAt: FIRST_NOW,
      workflowRunId: "run-501",
    });
    expect(external.ensureRepository).toHaveBeenCalledTimes(1);
    expect(external.ensureKvNamespace).toHaveBeenCalledTimes(1);
    expect(external.ensureD1Database).toHaveBeenCalledTimes(1);
    expect(external.ensureQueues).toHaveBeenCalledTimes(1);
    expect(external.commitSource).toHaveBeenCalledTimes(1);
    expect(external.dispatchWorkflow).toHaveBeenCalledTimes(2);
  });

  it("rejects a workflow run whose display title has a different source SHA", async () => {
    const store = new MemoryPublishStore();
    const external = externalMocks();
    vi.mocked(external.getWorkflowRun).mockResolvedValue({
      status: "completed",
      conclusion: "success",
      headSha: "newer-default-branch-head",
      displayTitle: `Deploy publish-11 ${"f".repeat(40)}`,
    });
    const deps = dependencies(store, external);
    await started(store, deps);
    for (let index = 0; index < 7; index += 1) {
      await advanceSimpleFormPublish({ clientId: 5, funnelId: 11 }, deps);
    }

    const failed = await advanceSimpleFormPublish(
      { clientId: 5, funnelId: 11 },
      deps
    );

    expect(failed).toMatchObject({
      status: "failed",
      step: "monitor_workflow",
      error: expect.stringMatching(/manual attention/i),
    });
    expect(external.patchRuntimeSecrets).not.toHaveBeenCalled();
  });

  it("never exposes runtime secrets or lease tokens in browser status", async () => {
    const store = new MemoryPublishStore();
    const deps = dependencies(store);
    await started(store, deps);
    if (!store.job) throw new Error("Expected publish job.");
    const internalIntent = new Date("2026-08-17T18:00:12.345Z");
    store.job = {
      ...store.job,
      leaseToken: "private-lease",
      repositoryCreateRequestedAt: internalIntent,
      lastError: "Safe summary",
    };

    const serialized = JSON.stringify(toSimpleFormPublishStatus(store.job));

    expect(serialized).not.toContain("server-only");
    expect(serialized).not.toContain("private-lease");
    expect(serialized).not.toContain("repositoryCreateRequestedAt");
    expect(serialized).not.toContain(internalIntent.toISOString());
    expect(serialized).toContain("Safe summary");
  });
});
