import { describe, expect, it } from "vitest";
import {
  isPreviewWorkerUrl,
  previewEnvironmentAlerts,
  productionEnvironmentAlerts,
  resolveProductionLiveUrl,
} from "./launchAlerts";

describe("production URL", () => {
  it("treats a -preview workers.dev host as preview, not live", () => {
    expect(
      isPreviewWorkerUrl(
        "https://website-theme-matrix-qa-7-preview.raymond-033.workers.dev",
      ),
    ).toBe(true);
    expect(
      isPreviewWorkerUrl("https://website-theme-matrix-qa-7.raymond-033.workers.dev"),
    ).toBe(false);
  });

  it("drops a live URL that is actually the preview Worker", () => {
    const preview =
      "https://website-theme-matrix-qa-7-preview.raymond-033.workers.dev/";
    expect(resolveProductionLiveUrl(preview, preview)).toBeNull();
    expect(
      resolveProductionLiveUrl(
        "https://website-theme-matrix-qa-7.raymond-033.workers.dev",
        preview,
      ),
    ).toBe("https://website-theme-matrix-qa-7.raymond-033.workers.dev");
  });
});

describe("previewEnvironmentAlerts", () => {
  it("warns when no preview exists", () => {
    expect(
      previewEnvironmentAlerts({
        kind: "idle",
        error: null,
        warningCount: 0,
        hasPreviewUrl: false,
        approved: false,
      }),
    ).toEqual([
      expect.objectContaining({
        key: "preview-missing",
        tone: "warning",
        title: "No preview yet",
      }),
    ]);
  });

  it("surfaces a failed job as a danger alert", () => {
    const alerts = previewEnvironmentAlerts({
      kind: "failed",
      error: "Healthcheck failed",
      warningCount: 2,
      hasPreviewUrl: false,
      approved: false,
    });

    expect(alerts[0]).toMatchObject({
      key: "preview-failed",
      tone: "danger",
      detail: "Healthcheck failed",
    });
    expect(alerts.some(alert => alert.key === "preview-warnings")).toBe(false);
  });

  it("explains a missing draft image as a storage-environment gap", () => {
    const alerts = previewEnvironmentAlerts({
      kind: "failed",
      error:
        "Draft image is missing: clients/8-the-hot-tub-store/astro/navLogo-abc.webp",
      warningCount: 0,
      hasPreviewUrl: false,
      approved: false,
    });

    expect(alerts[0]?.detail).toContain("not in this environment's storage");
    expect(alerts[0]?.detail).toContain("Re-upload \"navLogo-abc.webp\"");
  });

  it("asks for approval when a ready preview has not been signed off", () => {
    expect(
      previewEnvironmentAlerts({
        kind: "ready",
        error: null,
        warningCount: 0,
        hasPreviewUrl: true,
        approved: false,
      }).map(alert => alert.key),
    ).toEqual(["preview-unapproved"]);
  });

  it("stays quiet until preview status has loaded", () => {
    expect(
      previewEnvironmentAlerts({
        kind: "unknown",
        error: null,
        warningCount: 2,
        hasPreviewUrl: false,
        approved: false,
      }),
    ).toEqual([]);
  });

  it("stays quiet while a job is running and nothing else is missing", () => {
    expect(
      previewEnvironmentAlerts({
        kind: "active",
        error: null,
        warningCount: 0,
        hasPreviewUrl: false,
        approved: false,
      }),
    ).toEqual([]);
  });
});

describe("productionEnvironmentAlerts", () => {
  it("calls out a live URL that is still the preview Worker", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "idle",
        error: null,
        hasLiveUrl: false,
        previewKind: "ready",
        approved: true,
        blockers: [],
        liveUrlIsPreview: true,
      }).map(alert => alert.key),
    ).toContain("production-same-as-preview");
  });

  it("warns when production has never been published", () => {
    const alerts = productionEnvironmentAlerts({
      kind: "idle",
      error: null,
      hasLiveUrl: false,
      previewKind: "idle",
      approved: false,
      blockers: [],
    });

    expect(alerts.map(alert => alert.key)).toEqual([
      "production-missing",
      "production-needs-preview",
    ]);
  });

  it("lists launch blockers on the production card", () => {
    const alerts = productionEnvironmentAlerts({
      kind: "idle",
      error: null,
      hasLiveUrl: false,
      previewKind: "ready",
      approved: true,
      blockers: [{ label: "Required runtime secrets" }],
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "production-blockers",
          tone: "warning",
          detail: "Required runtime secrets",
        }),
      ]),
    );
  });

  it("does not claim production is unpublished while publish status is loading", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "unknown",
        error: null,
        hasLiveUrl: false,
        previewKind: "unknown",
        approved: false,
        blockers: [{ label: "Required runtime secrets" }],
      }),
    ).toEqual([]);
  });

  it("does not ask for a preview while preview status is still loading", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "live",
        error: null,
        hasLiveUrl: true,
        previewKind: "unknown",
        approved: false,
        blockers: [],
      }),
    ).toEqual([]);
  });

  it("does not nag about preview while production is publishing", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "active",
        error: null,
        hasLiveUrl: false,
        previewKind: "idle",
        approved: false,
        blockers: [{ label: "Website setup" }],
      }),
    ).toEqual([]);
  });

  it("warns when production is live only on workers.dev", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "live",
        error: null,
        hasLiveUrl: true,
        previewKind: "unknown",
        approved: false,
        blockers: [],
        liveUrlIsWorkersDev: true,
      }).map(alert => alert.key),
    ).toEqual(["production-workers-dev"]);
  });

  it("warns when live production is sitting on an unapproved preview", () => {
    expect(
      productionEnvironmentAlerts({
        kind: "live",
        error: null,
        hasLiveUrl: true,
        previewKind: "ready",
        approved: false,
        blockers: [],
      }).map(alert => alert.key),
    ).toEqual(["production-preview-unapproved"]);
  });
});
