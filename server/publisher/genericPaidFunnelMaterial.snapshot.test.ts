import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  openGenericPaidFunnelMaterialSnapshot,
  sealGenericPaidFunnelMaterialSnapshot,
} from "./genericPaidFunnelMaterial";

describe("generic paid funnel material snapshots", () => {
  const previousKey = process.env.SECRETS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SECRETS_ENCRYPTION_KEY = "test-only-material-snapshot-key";
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
    else process.env.SECRETS_ENCRYPTION_KEY = previousKey;
  });

  it("round-trips one encrypted release snapshot without plaintext secrets", () => {
    const encrypted = sealGenericPaidFunnelMaterialSnapshot({
      files: [
        { path: "src/pages/index.astro", content: "<h1>Current release</h1>" },
      ],
      runtimeVars: { META_PIXEL_ID: "123456789012345" },
      runtimeSecrets: { META_CAPI_ACCESS_TOKEN: "opaque-meta-token" },
    });

    expect(encrypted).not.toContain("opaque-meta-token");
    expect(openGenericPaidFunnelMaterialSnapshot(encrypted)).toEqual({
      files: [
        { path: "src/pages/index.astro", content: "<h1>Current release</h1>" },
      ],
      runtimeVars: { META_PIXEL_ID: "123456789012345" },
      runtimeSecrets: { META_CAPI_ACCESS_TOKEN: "opaque-meta-token" },
    });
  });
});
