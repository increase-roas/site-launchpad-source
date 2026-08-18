import { describe, expect, it } from "vitest";
import {
  autosaveRequestMatches,
  beginAutosave,
  confirmDirtyNavigation,
  createAutosaveFlight,
  lastSavedEditSeq,
  resolveAutosave,
  shouldStartAutosave,
  studioHasUnsavedWork,
} from "./autosave";
import { createDocumentFromFixture, createStudioState, insertPaletteOnCanvas } from "./store";

describe("paid funnel autosave in-flight race", () => {
  it("queues a mid-save edit and does not mark saved until the newest editSeq persists", () => {
    let state = createStudioState(createDocumentFromFixture(3, "race"));
    state = {
      ...state,
      document: {
        ...state.document,
        funnelId: 9,
        stepId: 11,
        expectedUpdatedAt: "2026-08-18T13:00:00.000Z",
      },
    };
    let flight = createAutosaveFlight();

    state = insertPaletteOnCanvas(state, { source: "section", preset: "cta" });
    expect(state.document.saveStatus).toBe("saving");
    expect(state.document.editSeq).toBe(1);
    expect(studioHasUnsavedWork(state.document)).toBe(true);
    expect(
      shouldStartAutosave({ document: state.document, flight, isPending: false }),
    ).toBe(true);

    const firstRequest = {
      sessionId: 1,
      clientId: 3,
      funnelId: 9,
      stepId: 11,
      editSeq: state.document.editSeq,
    };
    flight = beginAutosave(firstRequest);
    expect(flight.inFlightEditSeq).toBe(1);
    expect(
      shouldStartAutosave({ document: state.document, flight, isPending: true }),
    ).toBe(false);

    const afterFirstEdit = state;
    state = insertPaletteOnCanvas(state, { source: "section", preset: "faq" });
    expect(state.document.editSeq).toBe(2);
    expect(state.document.saveStatus).toBe("saving");
    expect(state.document.graph.pages.landing.sections.length).toBe(
      afterFirstEdit.document.graph.pages.landing.sections.length + 1,
    );
    expect(
      shouldStartAutosave({ document: state.document, flight, isPending: true }),
    ).toBe(false);

    const first = resolveAutosave({
      state,
      flight,
      savedEditSeq: 1,
      persist: { expectedUpdatedAt: "2026-08-18T13:00:01.000Z", stepId: 11 },
    });
    expect(first.state.document.saveStatus).toBe("saving");
    expect(first.state.document.editSeq).toBe(2);
    expect(lastSavedEditSeq(first.state.document)).toBe(1);
    expect(first.needsResave).toBe(true);
    expect(first.state.document.expectedUpdatedAt).toBe("2026-08-18T13:00:01.000Z");
    expect(studioHasUnsavedWork(first.state.document)).toBe(true);

    flight = beginAutosave({ ...firstRequest, editSeq: first.state.document.editSeq });
    expect(flight.inFlightEditSeq).toBe(2);
    const second = resolveAutosave({
      state: first.state,
      flight,
      savedEditSeq: 2,
      persist: { expectedUpdatedAt: "2026-08-18T13:00:02.000Z", stepId: 11 },
    });
    expect(second.state.document.saveStatus).toBe("saved");
    expect(second.needsResave).toBe(false);
    expect(lastSavedEditSeq(second.state.document)).toBe(2);
    expect(studioHasUnsavedWork(second.state.document)).toBe(false);
    expect(confirmDirtyNavigation(second.state.document, () => false)).toBe(true);
    expect(confirmDirtyNavigation(first.state.document, () => false)).toBe(false);
  });

  it("rejects responses from a closed or replaced studio session", () => {
    const request = {
      sessionId: 4,
      clientId: 3,
      funnelId: 9,
      stepId: 11,
      editSeq: 2,
    };
    const flight = beginAutosave(request);

    expect(autosaveRequestMatches(flight, request)).toBe(true);
    expect(autosaveRequestMatches(flight, { ...request, sessionId: 5 })).toBe(false);
    expect(autosaveRequestMatches(flight, { ...request, funnelId: 10 })).toBe(false);
    expect(autosaveRequestMatches(createAutosaveFlight(), request)).toBe(false);
  });

});
