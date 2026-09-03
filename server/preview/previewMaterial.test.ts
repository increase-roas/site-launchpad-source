import { afterEach, describe, expect, it } from "vitest";
import {
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
});
