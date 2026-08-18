import { describe, expect, it } from "vitest";
import { dropIndexFromPointer } from "./canvas";
import { findNode } from "./graph";
import { setButtonAction } from "./ops";
import {
  addStudioSurveyQuestion,
  canDeleteStudioSurveyQuestion,
  createDocumentFromFixture,
  createStudioState,
  deleteStudioSurveyQuestion,
  insertPaletteOnCanvas,
  moveCurrentStudioNode,
  setStudioDevice,
  setStudioZoom,
  studioHotkey,
} from "./store";

describe("paid funnel builder session helpers", () => {
  it("computes insertion indexes from pointer position", () => {
    expect(dropIndexFromPointer(0, 10, 0, 100)).toBe(0);
    expect(dropIndexFromPointer(4, 0, 0, 100)).toBe(0);
    expect(dropIndexFromPointer(4, 100, 0, 100)).toBe(4);
    expect(dropIndexFromPointer(2, 50, 0, 100)).toBe(1);
  });

  it("keeps device and zoom on the studio session", () => {
    let state = createStudioState(createDocumentFromFixture(2, "session-2"));
    state = setStudioDevice(state, "tablet");
    state = setStudioZoom(state, 1.25);
    expect(state.device).toBe("tablet");
    expect(state.zoom).toBe(1.25);
    state = setStudioZoom(state, 3);
    expect(state.zoom).toBe(2);
  });

  it("inserts a section from the palette onto the active page", () => {
    let state = createStudioState(createDocumentFromFixture(2, "session-insert"));
    const before = state.document.graph.pages.landing.sections.length;
    state = insertPaletteOnCanvas(state, { source: "section", preset: "cta" });
    expect(state.document.graph.pages.landing.sections.length).toBe(before + 1);
    expect(state.document.saveStatus).toBe("saving");
  });

  it("copies and pastes a selected section", () => {
    let state = createStudioState(createDocumentFromFixture(2, "session-paste"));
    const sectionId = state.document.graph.pages.landing.sections[0]!.id;
    state = { ...state, selectedId: sectionId };
    state = studioHotkey(state, "c", { meta: true });
    expect(state.clipboard?.kind).toBe("section");
    const count = state.document.graph.pages.landing.sections.length;
    state = studioHotkey(state, "v", { meta: true });
    expect(state.document.graph.pages.landing.sections.length).toBe(count + 1);
  });

  it("deletes only added survey pages and reconnects step plus button routes", () => {
    let state = createStudioState(createDocumentFromFixture(2, "session-delete-survey"));
    expect(canDeleteStudioSurveyQuestion(state, "survey-homeowner")).toBe(false);

    state = addStudioSurveyQuestion(state);
    const addedKey = state.stepKey;
    expect(addedKey).toBe("survey-question-3");
    expect(canDeleteStudioSurveyQuestion(state)).toBe(true);
    const landingButton = state.document.graph.pages.landing.sections
      .flatMap(section => section.rows)
      .flatMap(row => row.columns)
      .flatMap(column => column.elements)
      .find(element => element.type === "button")!;
    state = {
      ...state,
      document: {
        ...state.document,
        graph: setButtonAction(state.document.graph, landingButton.id, { type: "step", stepKey: addedKey }),
      },
    };

    state = deleteStudioSurveyQuestion(state);
    expect(state.document.graph.steps.some(step => step.key === addedKey)).toBe(false);
    expect(state.document.graph.pages[addedKey]).toBeUndefined();
    expect(state.document.graph.steps.find(step => step.key === "survey-timeline")?.nextStep).toEqual({
      type: "step",
      stepKey: "form",
    });
    const repairedButton = findNode(state.document.graph, landingButton.id)?.node;
    expect(repairedButton?.kind === "element" ? repairedButton.props.action : null).toEqual({
      type: "step",
      stepKey: "form",
    });
  });

  it("moves from the latest autosave state without restoring a stale version token", () => {
    const base = createStudioState(createDocumentFromFixture(2, "session-latest-drag"));
    const column = base.document.graph.pages.landing.sections[0]!.rows[0]!.columns[0]!;
    const moving = column.elements[0]!;
    const latest = {
      ...base,
      document: {
        ...base.document,
        expectedUpdatedAt: "2026-08-18T16:00:01.000Z",
        lastSavedEditSeq: 4,
        editSeq: 4,
        saveStatus: "saved" as const,
      },
    };

    const moved = moveCurrentStudioNode(latest, moving.id, {
      parentId: column.id,
      parentKind: "column",
      index: column.elements.length,
    });
    expect(moved?.document.expectedUpdatedAt).toBe("2026-08-18T16:00:01.000Z");
    expect(moved?.document.lastSavedEditSeq).toBe(4);
    expect(moved?.document.editSeq).toBe(5);
  });
});
