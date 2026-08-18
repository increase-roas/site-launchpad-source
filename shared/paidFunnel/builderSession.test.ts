import { describe, expect, it } from "vitest";
import { dropIndexFromPointer } from "./canvas";
import { createDocumentFromFixture, createStudioState, insertPaletteOnCanvas, setStudioDevice, setStudioZoom, studioHotkey } from "./store";

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
});
