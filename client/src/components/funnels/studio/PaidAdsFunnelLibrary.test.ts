import { describe, expect, it } from "vitest";
import {
  CREATE_BLANK_FUNNEL_LABEL,
  PAID_ADS_LIBRARY_TAB_ITEMS,
  PAID_ADS_PRIMARY_TAB,
  isBlankPaidFunnel,
  paidFunnelLibrarySourceLabel,
} from "@shared/paidFunnel";

describe("PaidAdsFunnelLibrary", () => {
  it("treats My Funnels and Create blank funnel as the primary library actions", () => {
    expect(PAID_ADS_PRIMARY_TAB).toBe("mine");
    expect(PAID_ADS_LIBRARY_TAB_ITEMS[0]).toEqual(["mine", "My Funnels"]);
    expect(PAID_ADS_LIBRARY_TAB_ITEMS[1]).toEqual(["templates", "Templates"]);
    expect(CREATE_BLANK_FUNNEL_LABEL).toBe("Create blank funnel");
  });

  it("labels blank funnels without requiring a template clone", () => {
    const blank = { source: "template", templateVersionId: null, name: "Northland Spas Funnel" };
    const fromTemplate = { source: "fixture", templateVersionId: 8, name: "Northland Spas Paid Funnel" };
    expect(isBlankPaidFunnel(blank)).toBe(true);
    expect(isBlankPaidFunnel(fromTemplate)).toBe(false);
    expect(paidFunnelLibrarySourceLabel(blank)).toBe("blank");
    expect(paidFunnelLibrarySourceLabel(fromTemplate)).toBe("fixture");
  });
});
