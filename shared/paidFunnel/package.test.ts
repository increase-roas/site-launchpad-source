import { describe, expect, it } from "vitest";
import { CANONICAL_OFFLINE_CONVERSION_CONTRACT } from "./graph";
import { GENERIC_PAID_FUNNEL_PACKAGE, createGenericPaidFunnelFixture } from "./fixture";
import { detectPaidFunnelPackage, validatePaidFunnelZipIntake } from "./package";

describe("paid funnel package and archive intake", () => {
  it("keeps paid-funnel kind and the lead offline-conversion contract", () => {
    const graph = createGenericPaidFunnelFixture("pkg");
    expect(graph.kind).toBe("paid-funnel");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.kind).toBe("paid-funnel");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.kind).not.toBe("website");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract).toEqual(CANONICAL_OFFLINE_CONVERSION_CONTRACT);
    expect(GENERIC_PAID_FUNNEL_PACKAGE.publishAdapter).toBe("generic-paid-funnel");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract.joinKey).toBe("leadUuid");
  });

  it("rejects unsafe archive contents and oversize packages", () => {
    expect(validatePaidFunnelZipIntake([{ path: "../secret.json", size: 10 }]).ok).toBe(false);
    expect(validatePaidFunnelZipIntake([{ path: ".env", size: 10 }]).ok).toBe(false);
    expect(validatePaidFunnelZipIntake([{ path: "setup.sh", size: 10 }]).ok).toBe(false);
    expect(validatePaidFunnelZipIntake([{ path: "index.html", size: 10 }], { archiveName: "site.tar" }).ok).toBe(false);
    expect(validatePaidFunnelZipIntake([{ path: "index.html", size: 10 }], { archiveBytes: 51 * 1024 * 1024 }).ok).toBe(false);
    const many = Array.from({ length: 2001 }, (_, index) => ({ path: `f${index}.html`, size: 1 }));
    expect(validatePaidFunnelZipIntake(many).ok).toBe(false);
  });

  it("auto-detects a root manifest and drafts unsupported regions", () => {
    expect(detectPaidFunnelPackage([{ path: "launchpad.template.json", size: 20 }, { path: "index.html", size: 20 }])).toMatchObject({
      status: "ready",
      hasExplicitManifest: true,
      framework: "static-html",
    });
    const draft = detectPaidFunnelPackage([{ path: "nested/launchpad.template.json", size: 20 }]);
    expect(draft.status).toBe("draft");
    if (draft.status === "draft") {
      expect(draft.unsupportedRegions.some(item => item.includes("manifest"))).toBe(true);
    }
  });
});
