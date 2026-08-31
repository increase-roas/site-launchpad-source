import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STRUCTURES,
  activeCampaignStructures,
  campaignFlowLabel,
  campaignStructure,
  campaignStructureForTemplate,
} from "./campaigns";
import { SIMPLE_FORM_TEMPLATE_KEY } from "./simpleFormContract";

describe("campaign structures", () => {
  it("keeps the three funnel shapes operators can pick between", () => {
    expect(CAMPAIGN_STRUCTURES.map(structure => structure.key)).toEqual([
      "lead-capture",
      "qualification",
      "appointment",
    ]);
    expect(campaignFlowLabel(campaignStructure("appointment"))).toBe(
      "ZIP → Survey → Contact → Book → Thank You",
    );
  });

  it("only offers structures that a template can actually build", () => {
    expect(activeCampaignStructures().map(structure => structure.key)).toEqual([
      "lead-capture",
    ]);
    for (const structure of CAMPAIGN_STRUCTURES) {
      expect(structure.templateKey === null).toBe(structure.availability === "deferred");
    }
  });

  it("resolves an existing campaign back to the structure that built it", () => {
    expect(campaignStructureForTemplate(SIMPLE_FORM_TEMPLATE_KEY)?.key).toBe("lead-capture");
    expect(campaignStructureForTemplate(null)).toBeNull();
    expect(campaignStructureForTemplate("unknown-template")).toBeNull();
  });

  it("files every structure under a known objective", () => {
    for (const structure of CAMPAIGN_STRUCTURES) {
      expect(CAMPAIGN_OBJECTIVES).toContain(structure.objective);
    }
  });
});
