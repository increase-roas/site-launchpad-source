import { describe, expect, it } from "vitest";
import type { AstroSitePreviewStatusView } from "@shared/astroSitePreview";
import type { AstroSitePublishStatusView } from "@shared/astroSitePublish";
import {
  pipelinePhaseVisualState,
  previewEnvironmentKind,
  previewPipelineJobKind,
  previewPipelinePhase,
  publishEnvironmentKind,
  publishPipelineJobKind,
  publishPipelinePhase,
} from "./launchPipeline";

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

function publish(
  overrides: Partial<AstroSitePublishStatusView> = {},
): AstroSitePublishStatusView {
  return {
    id: "pub-1",
    status: "running",
    step: "dispatch_workflow",
    progress: { completed: 5, total: 9 },
    error: null,
    externalSiteId: "website-abc-5",
    repositoryName: "website-abc-5",
    workerName: "website-abc-5",
    repositoryUrl: null,
    liveUrl: null,
    dispatchRequestedAt: null,
    workflowRunId: null,
    workflowStatus: null,
    completedAt: null,
    updatedAt: new Date("2026-09-02T00:00:00Z"),
    ...overrides,
  };
}

describe("previewPipelinePhase", () => {
  it("groups infrastructure work as prepare", () => {
    expect(previewPipelinePhase("create_repository")).toBe("prepare");
    expect(previewPipelinePhase("ensure_d1_database")).toBe("prepare");
    expect(previewPipelinePhase("ensure_r2_bucket")).toBe("prepare");
    expect(previewPipelinePhase("commit_source")).toBe("prepare");
  });

  it("groups the GitHub Action as build", () => {
    expect(previewPipelinePhase("dispatch_workflow")).toBe("build");
    expect(previewPipelinePhase("monitor_workflow")).toBe("build");
  });

  it("groups Cloudflare cutover as deploy", () => {
    expect(previewPipelinePhase("patch_runtime_secrets")).toBe("deploy");
    expect(previewPipelinePhase("verify_preview")).toBe("deploy");
  });

  it("marks ready as complete", () => {
    expect(previewPipelinePhase("ready")).toBe("complete");
  });
});

describe("publishPipelinePhase", () => {
  it("mirrors preview grouping through get_live_url", () => {
    expect(publishPipelinePhase("commit_source")).toBe("prepare");
    expect(publishPipelinePhase("monitor_workflow")).toBe("build");
    expect(publishPipelinePhase("get_live_url")).toBe("deploy");
    expect(publishPipelinePhase("attach_custom_domain")).toBe("deploy");
    expect(publishPipelinePhase("published")).toBe("complete");
  });
});

describe("environment kinds", () => {
  it("treats a stale ready preview as stale, not ready", () => {
    expect(previewEnvironmentKind(undefined)).toBe("unknown");
    expect(previewEnvironmentKind(null)).toBe("idle");
    expect(previewEnvironmentKind(preview({ status: "running" }))).toBe("active");
    expect(previewEnvironmentKind(preview({ status: "failed" }))).toBe("failed");
    expect(previewEnvironmentKind(preview({ status: "ready", stale: false }))).toBe(
      "ready",
    );
    expect(previewEnvironmentKind(preview({ status: "ready", stale: true }))).toBe(
      "stale",
    );
  });

  it("maps publish jobs onto idle / active / failed / live", () => {
    expect(publishEnvironmentKind(undefined)).toBe("unknown");
    expect(publishEnvironmentKind(null)).toBe("idle");
    expect(publishEnvironmentKind(publish({ status: "pending" }))).toBe("active");
    expect(publishEnvironmentKind(publish({ status: "failed" }))).toBe("failed");
    expect(publishEnvironmentKind(publish({ status: "published" }))).toBe("live");
  });

  it("collapses ready and stale previews into a complete pipeline", () => {
    expect(previewPipelineJobKind("unknown")).toBe("idle");
    expect(previewPipelineJobKind("ready")).toBe("complete");
    expect(previewPipelineJobKind("stale")).toBe("complete");
    expect(publishPipelineJobKind("live")).toBe("complete");
  });
});

describe("pipelinePhaseVisualState", () => {
  it("leaves every phase muted until a job starts", () => {
    expect(pipelinePhaseVisualState("prepare", "prepare", "idle")).toBe("todo");
    expect(pipelinePhaseVisualState("complete", "prepare", "idle")).toBe("todo");
  });

  it("checks every phase when the job is complete", () => {
    expect(pipelinePhaseVisualState("prepare", "complete", "complete")).toBe("done");
    expect(pipelinePhaseVisualState("complete", "complete", "complete")).toBe("done");
  });

  it("highlights the current phase while the job is running", () => {
    expect(pipelinePhaseVisualState("prepare", "build", "active")).toBe("done");
    expect(pipelinePhaseVisualState("build", "build", "active")).toBe("current");
    expect(pipelinePhaseVisualState("deploy", "build", "active")).toBe("todo");
  });

  it("marks the current phase as failed and leaves later phases untouched", () => {
    expect(pipelinePhaseVisualState("prepare", "deploy", "failed")).toBe("done");
    expect(pipelinePhaseVisualState("deploy", "deploy", "failed")).toBe("failed");
    expect(pipelinePhaseVisualState("complete", "deploy", "failed")).toBe("todo");
  });
});
