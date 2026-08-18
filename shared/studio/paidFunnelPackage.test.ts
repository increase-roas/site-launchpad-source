import { describe, expect, it } from "vitest";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "../simpleFormContract";
import {
  buildGenericPaidFunnelPackageFixture,
  isSunPoolName,
  parsePaidFunnelPackage,
} from "./paidFunnelPackage";

describe("paid-funnel package contract", () => {
  it("parses the generic multi-step paid funnel fixture", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    expect(pkg.kind).toBe("paid-funnel");
    expect(pkg.schemaVersion).toBe(1);
    expect(pkg.publishAdapter).toBe("generic-paid-funnel");
    expect(pkg.steps.map(step => step.type)).toEqual([
      "landing",
      "form",
      "thank-you",
      "booking",
      "upsell",
    ]);
    expect(pkg.offlineConversionContract).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT
    );
    expect(pkg.resources).toEqual({
      d1Databases: [
        { binding: "FUNNEL_DB", databaseName: "paid-funnel-events" },
      ],
    });
  });

  it("rejects a website kind", () => {
    const result = parsePaidFunnelPackage({
      ...buildGenericPaidFunnelPackageFixture(),
      kind: "website",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a drifted offline conversion join key", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const result = parsePaidFunnelPackage({
      ...pkg,
      offlineConversionContract: {
        ...pkg.offlineConversionContract,
        joinKey: "email",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing visual graph and slots", () => {
    const pkg = {
      ...buildGenericPaidFunnelPackageFixture(),
    };
    delete (pkg as { graph?: unknown }).graph;
    const result = parsePaidFunnelPackage(pkg);
    expect(result.success).toBe(false);
  });

  it("treats Sun Pool names as forbidden", () => {
    expect(isSunPoolName("Sun Pool")).toBe(true);
    expect(isSunPoolName("sun-pool")).toBe(true);
    expect(isSunPoolName("qa-client")).toBe(false);
  });
});
