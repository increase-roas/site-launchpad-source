import { describe, expect, it } from "vitest";
import type { AstroSitePreviewStatusView } from "@shared/astroSitePreview";
import {
  isPreviewActive,
  previewActionLabel,
  previewAdvanceDelayMs,
  previewPercent,
  previewPollIntervalMs,
  previewStartsFreshJob,
} from "./astroPreviewFlow";

function preview(
  overrides: Partial<AstroSitePreviewStatusView> = {},
): AstroSitePreviewStatusView {
  return {
    id: "job-1",
    status: "running",
    step: "commit_source",
    progress: { completed: 3, total: 8 },
    clientRevision: 27,
    currentRevision: 27,
    stale: false,
    templateSha: "2ced3065460a31a497df96b214e2a0f0ace27f3d",
    commitSha: null,
    previewUrl: null,
    repositoryName: "website-abc-5",
    workerName: "website-abc-5-preview",
    repositoryUrl: null,
    warnings: [],
    error: null,
    errorCode: null,
    approvedSha: null,
    approvedAt: null,
    dispatchRequestedAt: null,
    workflowRunId: null,
    workflowStatus: null,
    completedAt: null,
    createdAt: new Date("2026-09-02T00:00:00Z"),
    updatedAt: new Date("2026-09-02T00:00:00Z"),
    ...overrides,
  };
}

describe("preview activity", () => {
  it("treats only pending and running jobs as active", () => {
    expect(isPreviewActive(preview({ status: "pending" }))).toBe(true);
    expect(isPreviewActive(preview({ status: "running" }))).toBe(true);
    expect(isPreviewActive(preview({ status: "failed" }))).toBe(false);
    expect(isPreviewActive(preview({ status: "ready" }))).toBe(false);
  });

  it("polls only while a preview job is live", () => {
    expect(previewPollIntervalMs(preview())).toBe(3_000);
    expect(previewPollIntervalMs(preview({ status: "ready" }))).toBe(false);
  });

  it("waits before polling a workflow it just dispatched", () => {
    expect(previewAdvanceDelayMs(preview({ step: "create_repository" }))).toBe(0);
    expect(previewAdvanceDelayMs(preview({ step: "monitor_workflow" }))).toBe(2_000);
    expect(previewAdvanceDelayMs(preview({ status: "ready", step: "ready" }))).toBeNull();
  });

  it("names the generate action from job state", () => {
    expect(previewActionLabel(null)).toBe("Generate Preview");
    expect(previewActionLabel(preview({ status: "ready", stale: true }))).toBe("Update Preview");
    expect(previewActionLabel(preview({ status: "failed" }))).toBe("Retry Preview");
    expect(previewPercent({ completed: 4, total: 8 })).toBe(50);
  });

  it("starts a new job after failure so the latest config and bindings are committed", () => {
    expect(previewStartsFreshJob(null)).toBe(true);
    expect(previewStartsFreshJob(preview({ status: "failed" }))).toBe(true);
    expect(previewStartsFreshJob(preview({ status: "ready" }))).toBe(true);
    expect(previewStartsFreshJob(preview({ status: "pending" }))).toBe(false);
    expect(previewStartsFreshJob(preview({ status: "running" }))).toBe(false);
  });
});
