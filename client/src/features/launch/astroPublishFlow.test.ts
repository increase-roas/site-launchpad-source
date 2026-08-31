import { describe, expect, it } from "vitest";
import type { AstroSitePublishStatusView } from "@shared/astroSitePublish";
import {
  isPublishActive,
  publishAdvanceDelayMs,
  publishPercent,
  publishPollIntervalMs,
  publishStepLabel,
} from "./astroPublishFlow";

function publish(
  overrides: Partial<AstroSitePublishStatusView> = {},
): AstroSitePublishStatusView {
  return {
    id: "job-1",
    status: "running",
    step: "commit_source",
    progress: { completed: 3, total: 8 },
    error: null,
    externalSiteId: "astro-site-client-5",
    repositoryName: "website-client-5",
    workerName: "website-client-5",
    repositoryUrl: null,
    liveUrl: null,
    dispatchRequestedAt: null,
    workflowRunId: null,
    workflowStatus: null,
    completedAt: null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("publish activity", () => {
  it("treats only pending and running jobs as active", () => {
    expect(isPublishActive(publish({ status: "pending" }))).toBe(true);
    expect(isPublishActive(publish({ status: "running" }))).toBe(true);
    expect(isPublishActive(publish({ status: "failed" }))).toBe(false);
    expect(isPublishActive(publish({ status: "published" }))).toBe(false);
    expect(isPublishActive(null)).toBe(false);
    expect(isPublishActive(undefined)).toBe(false);
  });

  it("polls only while a job is live so an idle client issues no requests", () => {
    expect(publishPollIntervalMs(publish())).toBe(3_000);
    expect(publishPollIntervalMs(publish({ status: "published" }))).toBe(false);
    expect(publishPollIntervalMs(null)).toBe(false);
  });
});

describe("advancing the publish job", () => {
  it("refuses to advance a job that is absent or already settled", () => {
    expect(publishAdvanceDelayMs(null)).toBeNull();
    expect(publishAdvanceDelayMs(publish({ status: "failed" }))).toBeNull();
    expect(publishAdvanceDelayMs(publish({ status: "published" }))).toBeNull();
    expect(publishAdvanceDelayMs(publish({ step: "published" }))).toBeNull();
  });

  it("advances immediately for local steps", () => {
    expect(publishAdvanceDelayMs(publish({ step: "create_repository" }))).toBe(0);
    expect(publishAdvanceDelayMs(publish({ step: "dispatch_workflow" }))).toBe(0);
  });

  it("waits before polling a workflow it just asked GitHub to run", () => {
    expect(publishAdvanceDelayMs(publish({ step: "monitor_workflow" }))).toBe(2_000);
    expect(
      publishAdvanceDelayMs(
        publish({
          step: "dispatch_workflow",
          dispatchRequestedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      ),
    ).toBe(2_000);
  });
});

describe("publish presentation", () => {
  it("clamps progress into a percentage", () => {
    expect(publishPercent({ completed: 0, total: 8 })).toBe(0);
    expect(publishPercent({ completed: 4, total: 8 })).toBe(50);
    expect(publishPercent({ completed: 8, total: 8 })).toBe(100);
    expect(publishPercent({ completed: 9, total: 8 })).toBe(100);
    expect(publishPercent({ completed: 1, total: 0 })).toBe(0);
  });

  it("reads a step id as words", () => {
    expect(publishStepLabel("ensure_d1_database")).toBe("ensure d1 database");
  });
});
