import { describe, expect, it } from "vitest";
import {
  CANONICAL_OFFLINE_CONVERSION_CONTRACT,
  PAID_FUNNEL_SECTION_PRESETS,
  visitNodes,
} from "./graph";
import { createSectionPreset } from "./presets";
import {
  createGenericPaidFunnelFixture,
  fixtureRequiresOfflineConversion,
} from "./fixture";
import { applyOptInTemplate } from "./templates";

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

  it("ships editable image-choice and numbered-card layouts", () => {
    const hero = createSectionPreset("image-choice-hero");
    const heroElements = hero.rows
      .flatMap(row => row.columns)
      .flatMap(column => column.elements);
    const choice = heroElements.find(
      element => element.type === "multipleChoice"
    );
    expect(heroElements.map(element => element.type)).toEqual(
      expect.arrayContaining(["heading", "text", "image", "multipleChoice"])
    );
    expect(choice?.props).toMatchObject({
      columns: 2,
      options: ["Option one", "Option two"],
    });

    const steps = createSectionPreset("numbered-steps");
    const cards = steps.rows[1]?.columns ?? [];
    expect(cards).toHaveLength(3);
    expect(
      cards.every(
        card => card.background.kind === "color" && card.borderRadius === 16
      )
    ).toBe(true);
    expect(cards.map(card => String(card.elements[0]?.props.text))).toEqual([
      "1 · Get Started",
      "2 · Shop With Confidence",
      "3 · Choose Your Best Option",
    ]);
  });

  it("builds a complete multi-step paid funnel graph", () => {
    const graph = createGenericPaidFunnelFixture("qa");
    expect(graph.steps.map(step => step.key)).toEqual([
      "landing",
      "survey-homeowner",
      "survey-timeline",
      "form",
      "thankYou",
    ]);
    for (const step of graph.steps) {
      const page = graph.pages[step.key];
      expect(page?.kind).toBe("page");
      expect(page?.sections.length).toBeGreaterThan(0);
    }
    expect(fixtureRequiresOfflineConversion(graph)).toBe(true);
    expect(CANONICAL_OFFLINE_CONVERSION_CONTRACT.joinKey).toBe("leadUuid");
    expect(
      CANONICAL_OFFLINE_CONVERSION_CONTRACT.purchase
        .requiresExplicitPositiveValue
    ).toBe(true);
    let formCount = 0;
    visitNodes(graph, node => {
      if (node.kind === "element" && node.type === "form") formCount += 1;
    });
    expect(formCount).toBeGreaterThan(0);
    expect(JSON.stringify(graph)).toContain('"consent"');
    expect(JSON.stringify(graph)).not.toMatch(
      /hot tubs?|showroom|delivered spa/i
    );
  });

  it("keeps hot-tub copy available only as an explicit opt-in template", () => {
    const generic = createGenericPaidFunnelFixture("generic");
    const hotTub = applyOptInTemplate(generic, "hot-tub-promotion");
    expect(JSON.stringify(hotTub)).toMatch(/hot tubs|showroom/i);
    expect(JSON.stringify(generic)).not.toMatch(/hot tubs|showroom/i);
  });
});
