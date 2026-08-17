import { describe, expect, it } from "vitest";
import {
  publishActionLabel,
  publishProgressPercent,
  shouldAutoAdvancePublish,
} from "./SimpleFormFunnelEditor";

describe("Simple Form publish controls", () => {
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

  it("clamps progress to a display-safe percentage", () => {
    expect(publishProgressPercent({ completed: 0, total: 6 })).toBe(0);
    expect(publishProgressPercent({ completed: 3, total: 6 })).toBe(50);
    expect(publishProgressPercent({ completed: 8, total: 6 })).toBe(100);
    expect(publishProgressPercent({ completed: 1, total: 0 })).toBe(0);
  });
});
