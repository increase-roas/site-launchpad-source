import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPublishAdvanceController,
  effectivePublishStatus,
  publishActionLabel,
  publishActionForState,
  publishAdvanceDelayMs,
  publishProgressPercent,
  shouldAutoAdvancePublish,
} from "./SimpleFormFunnelEditor";

describe("Simple Form publish controls", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Publish initially, Retry after failure, and no action after success", () => {
    expect(publishActionLabel(null)).toBe("Publish");
    expect(
      publishActionLabel({
        status: "pending",
        step: "commit_source",
      })
    ).toBe("Retry");
    expect(
      publishActionLabel({
        status: "failed",
        step: "commit_source",
      })
    ).toBe("Retry");
    expect(
      publishActionLabel({
        status: "published",
        step: "published",
      })
    ).toBeNull();
  });

  it("auto-advances non-terminal work so expired leases can be reclaimed", () => {
    expect(
      shouldAutoAdvancePublish({
        status: "pending",
        step: "ensure_d1_database",
      })
    ).toBe(true);
    expect(
      shouldAutoAdvancePublish({
        status: "running",
        step: "ensure_d1_database",
      })
    ).toBe(true);
    expect(
      shouldAutoAdvancePublish({
        status: "failed",
        step: "ensure_d1_database",
      })
    ).toBe(false);
    expect(shouldAutoAdvancePublish(null)).toBe(false);
  });

  it("resumes auto-advance from publish status loaded after reload", () => {
    const serverPublish = {
      status: "pending" as const,
      step: "ensure_d1_database" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };

    const publish = effectivePublishStatus(null, serverPublish);

    expect(publish).toBe(serverPublish);
    expect(shouldAutoAdvancePublish(publish)).toBe(true);
  });

  it("keeps a newer local mutation result when an older poll arrives later", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const controller = createPublishAdvanceController();
    const localPublish = {
      status: "published" as const,
      step: "published" as const,
      updatedAt: new Date("2026-08-17T12:00:02.000Z"),
    };
    const lateOlderPoll = {
      status: "running" as const,
      step: "monitor_workflow" as const,
      updatedAt: new Date("2026-08-17T12:00:01.000Z"),
    };

    const publish = effectivePublishStatus(localPublish, lateOlderPoll);
    controller.scheduleAutomatic(publish!, 0, request);
    vi.runOnlyPendingTimers();

    expect(publish).toBe(localPublish);
    expect(request).not.toHaveBeenCalled();
  });

  it("lets a genuinely newer persisted poll replace local mutation state", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const controller = createPublishAdvanceController();
    const localPublish = {
      status: "published" as const,
      step: "published" as const,
      updatedAt: new Date("2026-08-17T12:00:02.000Z"),
    };
    const newerPoll = {
      status: "pending" as const,
      step: "ensure_d1_database" as const,
      updatedAt: new Date("2026-08-17T12:00:03.000Z"),
    };
    const lateOlderPoll = {
      status: "running" as const,
      step: "monitor_workflow" as const,
      updatedAt: new Date("2026-08-17T12:00:01.000Z"),
    };

    const publish = effectivePublishStatus(localPublish, newerPoll);
    controller.scheduleAutomatic(publish!, 0, request);
    vi.runOnlyPendingTimers();

    expect(publish).toBe(newerPoll);
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      effectivePublishStatus(localPublish, lateOlderPoll, newerPoll)
    ).toBe(newerPoll);
  });

  it("prefers local mutation state when persisted versions are equal", () => {
    const updatedAt = new Date("2026-08-17T12:00:02.000Z");
    const localPublish = {
      status: "running" as const,
      step: "monitor_workflow" as const,
      updatedAt,
    };
    const equalVersionPoll = {
      status: "pending" as const,
      step: "dispatch_workflow" as const,
      updatedAt: new Date(updatedAt),
    };

    expect(effectivePublishStatus(localPublish, equalVersionPoll)).toBe(
      localPublish
    );
  });

  it("blocks overlapping client advances through the controller lock", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const publish = {
      status: "pending" as const,
      step: "ensure_d1_database" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };
    const controller = createPublishAdvanceController();

    controller.scheduleAutomatic(publish, 0, request);
    vi.runOnlyPendingTimers();

    expect(request).toHaveBeenCalledTimes(1);
    expect(controller.getState().locked).toBe(true);
    expect(controller.retry(publish, request)).toBe(false);

    controller.scheduleAutomatic(publish, 0, request);
    vi.runOnlyPendingTimers();
    expect(request).toHaveBeenCalledTimes(1);

    controller.completeRequest();
    expect(controller.retry(publish, request)).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("delays dispatch reconciliation like workflow monitoring", () => {
    expect(
      publishAdvanceDelayMs({
        status: "pending",
        step: "dispatch_workflow",
        dispatchRequestedAt: new Date("2026-08-17T12:00:00.000Z"),
      })
    ).toBe(2_000);
    expect(
      publishAdvanceDelayMs({
        status: "pending",
        step: "dispatch_workflow",
        dispatchRequestedAt: null,
      })
    ).toBe(0);
  });

  it("pauses after an automatic advance error until explicit Retry", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const publish = {
      status: "pending" as const,
      step: "ensure_d1_database" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };
    const controller = createPublishAdvanceController();

    controller.scheduleAutomatic(publish, 0, request);
    vi.runOnlyPendingTimers();
    expect(request).toHaveBeenCalledTimes(1);

    controller.completeError();
    controller.completeRequest();
    controller.scheduleAutomatic(publish, 0, request);
    controller.scheduleAutomatic(publish, 0, request);
    vi.runOnlyPendingTimers();

    expect(request).toHaveBeenCalledTimes(1);
    expect(controller.getState().pausedAfterErrorVersion).toBe(
      publish.updatedAt.getTime()
    );
    expect(controller.getState().locked).toBe(false);
    expect(
      publishActionForState(
        publish,
        controller.getState().pausedAfterErrorVersion
      )
    ).toBe("Retry");

    controller.retry(publish, request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(controller.getState().pausedAfterErrorVersion).toBeNull();
  });

  it("does not clear an automatic-error pause for the same cached job row", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const publish = {
      status: "running" as const,
      step: "monitor_workflow" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };
    const controller = createPublishAdvanceController();

    controller.scheduleAutomatic(publish, 0, request);
    vi.runOnlyPendingTimers();
    controller.completeError();
    controller.completeRequest();

    controller.observeSuccessfulStatus({ ...publish });
    expect(controller.getState().pausedAfterErrorVersion).toBe(
      publish.updatedAt.getTime()
    );

    controller.observeSuccessfulStatus({
      ...publish,
      updatedAt: new Date("2026-08-17T12:00:01.000Z"),
    });
    expect(controller.getState().pausedAfterErrorVersion).toBeNull();
  });

  it("prevents manual and automatic advances from overlapping", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const publish = {
      status: "pending" as const,
      step: "ensure_d1_database" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };
    const controller = createPublishAdvanceController();

    controller.scheduleAutomatic(publish, 0, request);
    controller.retry(publish, request);
    vi.runOnlyPendingTimers();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("clears a scheduled automatic advance when disposed", () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const publish = {
      status: "running" as const,
      step: "monitor_workflow" as const,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    };
    const controller = createPublishAdvanceController();

    controller.scheduleAutomatic(publish, 3_000, request);
    controller.dispose();
    vi.runAllTimers();

    expect(request).not.toHaveBeenCalled();
  });

  it("clamps progress to a display-safe percentage", () => {
    expect(publishProgressPercent({ completed: 0, total: 6 })).toBe(0);
    expect(publishProgressPercent({ completed: 3, total: 6 })).toBe(50);
    expect(publishProgressPercent({ completed: 8, total: 6 })).toBe(100);
    expect(publishProgressPercent({ completed: 1, total: 0 })).toBe(0);
  });
});
