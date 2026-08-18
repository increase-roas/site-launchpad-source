import { describe, expect, it } from "vitest";
import { CANONICAL_OFFLINE_CONVERSION_CONTRACT, PAID_FUNNEL_SECTION_PRESETS, visitNodes } from "./graph";
import { createSectionPreset } from "./presets";
import { createGenericPaidFunnelFixture, fixtureRequiresOfflineConversion } from "./fixture";

describe("paid-ad section presets and fixture", () => {
  it("ships every required section preset", () => {
    for (const preset of PAID_FUNNEL_SECTION_PRESETS) {
      const section = createSectionPreset(preset);
      expect(section.kind).toBe("section");
      expect(section.preset).toBe(preset);
      expect(section.rows.length).toBeGreaterThan(0);
      expect(section.rows[0]?.columns.length).toBeGreaterThan(0);
    }
  });

  it("builds a complete multi-step paid funnel graph", () => {
    const graph = createGenericPaidFunnelFixture("qa");
    expect(graph.steps.map(step => step.key)).toEqual(["landing", "form", "thankYou", "booking", "upsell"]);
    for (const step of graph.steps) {
      const page = graph.pages[step.key];
      expect(page?.kind).toBe("page");
      expect(page?.sections.length).toBeGreaterThan(0);
    }
    expect(fixtureRequiresOfflineConversion(graph)).toBe(true);
    expect(CANONICAL_OFFLINE_CONVERSION_CONTRACT.joinKey).toBe("leadUuid");
    expect(CANONICAL_OFFLINE_CONVERSION_CONTRACT.purchase.requiresExplicitPositiveValue).toBe(true);
    let formCount = 0;
    visitNodes(graph, node => {
      if (node.kind === "element" && node.type === "form") formCount += 1;
    });
    expect(formCount).toBeGreaterThan(0);
  });
});
