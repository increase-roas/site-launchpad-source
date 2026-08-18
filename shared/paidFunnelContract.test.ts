import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GENERIC_PAID_FUNNEL_TEMPLATE_KEY,
  paidFunnelPackageSchema,
  parsePaidFunnelPackage,
} from "./paidFunnelContract";
import { GENERIC_PAID_FUNNEL_PACKAGE } from "./paidFunnelFixture";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "./simpleFormContract";

function clonePackage() {
  return structuredClone(GENERIC_PAID_FUNNEL_PACKAGE);
}

describe("paid funnel package contract", () => {
  it("parses the vendored generic multi-step fixture", () => {
    const raw = JSON.parse(
      readFileSync(
        "server/templates/generic-paid-funnel/launchpad.template.json",
        "utf8"
      )
    );
    expect(parsePaidFunnelPackage(raw)).toEqual(GENERIC_PAID_FUNNEL_PACKAGE);
    expect(GENERIC_PAID_FUNNEL_PACKAGE.templateKey).toBe(
      GENERIC_PAID_FUNNEL_TEMPLATE_KEY
    );
    expect(GENERIC_PAID_FUNNEL_PACKAGE.kind).toBe("paid-funnel");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.steps.map(step => step.type)).toEqual([
      "landing",
      "survey",
      "survey",
      "form",
      "thankYou",
    ]);
    expect(GENERIC_PAID_FUNNEL_PACKAGE.resources).toEqual([
      { type: "d1", name: "paid-funnel-events", binding: "FUNNEL_DB" },
    ]);
    expect(GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT
    );
  });

  it("does not force KV, D1, or queue resources", () => {
    const pkg = clonePackage();
    pkg.resources = [];
    expect(paidFunnelPackageSchema.parse(pkg).resources).toEqual([]);
  });

  it("requires offlineConversionContract for form/lead steps", () => {
    const pkg = clonePackage();
    delete pkg.offlineConversionContract;
    expect(() => paidFunnelPackageSchema.parse(pkg)).toThrow(
      /offlineConversionContract must be present/
    );
  });

  it("requires a graph or immutableRegions + editableSlots", () => {
    const pkg = clonePackage();
    delete pkg.graph;
    delete pkg.immutableRegions;
    delete pkg.editableSlots;
    expect(() => paidFunnelPackageSchema.parse(pkg)).toThrow(
      /visual graph or immutableRegions/
    );
  });

  it("rejects unknown next-step targets", () => {
    const pkg = clonePackage();
    pkg.steps[0].nextStep = "missing";
    expect(() => paidFunnelPackageSchema.parse(pkg)).toThrow(
      /Unknown next step/
    );
  });

  it("stores secret names only", () => {
    const serialized = JSON.stringify(GENERIC_PAID_FUNNEL_PACKAGE);
    expect(serialized).toContain("META_CAPI_ACCESS_TOKEN");
    expect(serialized).not.toContain("EAAB");
    expect(serialized).not.toContain("sk_live");
  });
});
