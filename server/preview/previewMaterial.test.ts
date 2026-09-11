import { afterEach, describe, expect, it } from "vitest";
import {
  previewRuntimeSecretNamesFromProfile,
  protectPreviewMaterialSnapshot,
  readPreviewMaterialSnapshot,
} from "./previewMaterial";

describe("preview material snapshots", () => {
  const previous = process.env.SECRETS_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.SECRETS_ENCRYPTION_KEY = previous;
  });

  it("round-trips one encrypted preview snapshot without losing the revision", () => {
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-preview-snapshot-key";
    const snapshot = {
      generatedConfig: 'export const rawClientConfig = {"identity":{"name":"ABC"}};',
      runtimeSecrets: { ADMIN_PASSWORD: "preview-admin", ENVIRONMENT: "preview" },
      clientRevision: 27,
      warnings: [{ code: "favicon", message: "Favicon is not provided." }],
    };
    const encrypted = protectPreviewMaterialSnapshot(snapshot);
    expect(encrypted).not.toContain("preview-admin");
    expect(encrypted).not.toContain("ABC");
    expect(readPreviewMaterialSnapshot(encrypted)).toEqual(snapshot);
  });

  it("copies GHL location ID and API key when GHL is on and both are set", () => {
    expect(
      previewRuntimeSecretNamesFromProfile({
        ghlEnabled: true,
        metaEnabled: false,
        presentKeys: ["GHL_API_KEY", "GHL_LOCATION_ID", "ADMIN_PASSWORD"],
      }),
    ).toEqual(["ADMIN_PASSWORD", "GHL_API_KEY", "GHL_LOCATION_ID"]);
  });

  it("does not send GHL keys when the integration is off", () => {
    expect(
      previewRuntimeSecretNamesFromProfile({
        ghlEnabled: false,
        metaEnabled: false,
        presentKeys: ["GHL_API_KEY", "GHL_LOCATION_ID"],
      }),
    ).toEqual([]);
  });

  it("skips a GHL key that is not yet saved so preview still deploys", () => {
    expect(
      previewRuntimeSecretNamesFromProfile({
        ghlEnabled: true,
        metaEnabled: false,
        presentKeys: ["GHL_API_KEY"],
      }),
    ).toEqual(["GHL_API_KEY"]);
  });
});
