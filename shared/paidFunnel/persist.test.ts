import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "./fixture";
import { createIdFactory } from "./graph";
import {
  assembleStudioGraph,
  persistGraphInput,
  storageToStudioGraph,
  studioToPersistSteps,
  studioToStorageGraph,
} from "./persist";
import { migratePaidFunnelGraph } from "../paidFunnelGraph";

describe("paid funnel graph persist adapter", () => {
  it("round-trips a builder graph through the versioned Page→Section→Row→Column→Element storage shape", () => {
    const studio = createGenericPaidFunnelFixture(createIdFactory("rt"));
    const storage = studioToStorageGraph(studio);
    expect(storage.version).toBe(1);
    expect(storage.pages).toHaveLength(studio.steps.length);
    expect(storage.pages.every(page => page.kind === "page")).toBe(true);
    expect(storage.pages[0]?.sections[0]?.kind).toBe("section");
    expect(storage.pages[0]?.sections[0]?.rows[0]?.kind).toBe("row");
    expect(storage.pages[0]?.sections[0]?.rows[0]?.columns[0]?.kind).toBe("column");
    expect(storage.pages[0]?.sections[0]?.rows[0]?.columns[0]?.elements[0]?.kind).toBe("element");
    const ids = storage.pages.flatMap(page => [
      page.id,
      ...page.sections.flatMap(section => [
        section.id,
        ...section.rows.flatMap(row => [
          row.id,
          ...row.columns.flatMap(column => [column.id, ...column.elements.map(element => element.id)]),
        ]),
      ]),
    ]);
    expect(new Set(ids).size).toBe(ids.length);

    const restored = storageToStudioGraph(storage, {
      funnel: { id: 9, name: studio.name, slug: studio.funnelKey },
      steps: studio.steps.map((step, position) => ({
        id: position + 1,
        key: step.key,
        stepType: step.type,
        slug: step.slug,
        title: step.title,
        seo: step.seo,
        nextStep: step.nextStep.type === "step" ? step.nextStep.stepKey : null,
        previewState: step.previewState,
        publishState: step.publishState,
        position,
      })),
    });
    expect(restored.kind).toBe("paid-funnel");
    expect(restored.pages.landing.sections.length).toBe(studio.pages.landing.sections.length);
    expect(restored.globalStyles.colors.primary).toBe(studio.globalStyles.colors.primary);
  });

  it("persists survey URLs, routing, and Meta event metadata", () => {
    const studio = createGenericPaidFunnelFixture(createIdFactory("meta"));
    const steps = studioToPersistSteps(studio);
    const survey = steps.find(step => step.stepType === "survey");
    expect(survey?.slug).toMatch(/^\/survey\//);
    expect(survey?.nextStep).toBeTruthy();
    expect(survey?.seo._tracking).toMatchObject({
      browserEvent: "ViewContent",
      serverEvent: "LeadSurveyAnswer",
    });
  });

  it("assembles per-step registry graphs into one studio graph", () => {
    const fixture = createGenericPaidFunnelFixture(createIdFactory("as"));
    const storage = studioToStorageGraph(fixture);
    const now = new Date("2026-08-18T12:00:00.000Z");
    const assembled = assembleStudioGraph({
      funnel: { id: 4, name: "Northland Paid Funnel", slug: "northland-paid-funnel" },
      steps: fixture.steps.map((step, position) => ({
        id: position + 10,
        key: step.key,
        stepType: step.type,
        slug: step.slug,
        title: step.title,
        seo: step.seo,
        nextStep: step.nextStep.type === "step" ? step.nextStep.stepKey : null,
        previewState: "draft",
        publishState: "draft",
        position,
      })),
      graphs: storage.pages.map((page, index) => ({
        stepId: index + 10,
        updatedAt: now,
        graph: { version: 1, pages: [page] },
      })),
    });
    expect(assembled.graph.steps.map(step => step.key)).toEqual([
      "landing",
      "survey-homeowner",
      "survey-timeline",
      "form",
      "thankYou",
    ]);
    expect(Object.keys(assembled.graph.pages).sort()).toEqual([
      "form",
      "landing",
      "survey-homeowner",
      "survey-timeline",
      "thankYou",
    ]);
    expect(assembled.stepId).toBe(10);
  });

  it("accepts a builder pages record on saveGraph input", () => {
    const studio = createGenericPaidFunnelFixture(createIdFactory("sv"));
    const persisted = persistGraphInput(studio);
    expect(persisted.pages.length).toBeGreaterThan(1);
    expect(migratePaidFunnelGraph(persisted).pages[0]?.kind).toBe("page");
  });
});
