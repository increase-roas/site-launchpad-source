import { describe, expect, it } from "vitest";
import { addFunnelStep } from "./ops";
import { createEmptyGraph } from "./graph";
import { applyOptInTemplate, createSurveyQuestionStep, reorderFunnelSteps } from "./templates";

describe("Perspective-style Astro funnel templates", () => {
  it("supports an embedded form on the opt-in page", () => {
    const graph = applyOptInTemplate(createEmptyGraph({ funnelKey: "test", name: "Test" }), "hero-with-form");
    const types = graph.pages.landing.sections.flatMap(section => section.rows.flatMap(row => row.columns.flatMap(column => column.elements.map(element => element.type))));
    expect(types).toContain("form");
  });

  it("creates one stable route and Meta tracking contract per survey question", () => {
    const base = createEmptyGraph({ funnelKey: "test", name: "Test" });
    const question = createSurveyQuestionStep({
      key: "survey-timeline",
      slug: "survey/timeline",
      title: "Timeline",
      question: "When do you want to get started?",
      field: "timeline",
      options: ["Now", "This month", "Researching"],
    });
    const graph = addFunnelStep(base, question.step, question.page);
    expect(graph.steps[1]).toMatchObject({
      slug: "/survey/timeline",
      type: "survey",
      tracking: { browserEvent: "ViewContent", serverEvent: "LeadSurveyAnswer", answerField: "timeline" },
    });
    expect(graph.pages["survey-timeline"].sections[0]?.rows[0]?.columns[0]?.elements[1]?.type).toBe("multipleChoice");
  });

  it("reorders pages without changing their routes", () => {
    const base = createEmptyGraph({ funnelKey: "test", name: "Test" });
    const q = createSurveyQuestionStep({ key: "q1", slug: "survey/q1", title: "Q1", question: "Question?", field: "q1", options: ["A"] });
    const graph = addFunnelStep(base, q.step, q.page);
    expect(reorderFunnelSteps(graph, 1, 0).steps.map(step => [step.key, step.slug])).toEqual([["q1", "/survey/q1"], ["landing", "/"]]);
  });
});
