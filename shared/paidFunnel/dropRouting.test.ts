import { describe, expect, it, vi } from "vitest";
import { flattenCanvas, renderFunnelCanvas } from "./canvas";
import {
  canvasDragEventFlags,
  canMoveNodeTo,
  compatibleTargetKinds,
  dropIndexFromChildRects,
  dropIndexFromMidpoints,
  paletteItemLabel,
  parsePalettePayload,
  pointerDragStarted,
  routeCanvasEvent,
  siblingIndexTarget,
  simulateCanvasInteraction,
} from "./dropRouting";
import { createDocumentFromFixture, createStudioState, insertPaletteOnCanvas, moveStudioNode, studioHotkey } from "./store";
import type { PaletteItem } from "./ops";

const sectionItem: PaletteItem = { source: "section", preset: "hero" };
const rowItem: PaletteItem = { source: "row", columns: 2 };
const elementItem: PaletteItem = { source: "element", type: "button" };

describe("paid funnel canvas event routing", () => {
  it("does not let a nested section accept, stop, or insert a dragged section", () => {
    const insert = vi.fn();
    const nested = { parentId: "section-1", parentKind: "section" as const, index: 0 };
    const page = { parentId: "page-1", parentKind: "page" as const, index: 1 };
    expect(canvasDragEventFlags(nested, sectionItem)).toEqual({
      preventDefault: false,
      stopPropagation: false,
      accepted: false,
    });
    const routed = routeCanvasEvent([nested, page], sectionItem);
    expect(routed.accepted).toEqual(page);
    expect(routed.stoppedAt).toBe("page-1");
    expect(routed.flags[0]).toMatchObject({ accepted: false, stopPropagation: false });
    const result = simulateCanvasInteraction([nested, page], sectionItem, insert);
    expect(result.inserted).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0].parentKind).toBe("page");
    expect(insert.mock.calls[0][0].parentKind).not.toBe("section");
  });

  it("accepts a section drop on the page", () => {
    const page = { parentId: "page-1", parentKind: "page" as const, index: 0 };
    expect(canvasDragEventFlags(page, sectionItem)).toEqual({
      preventDefault: true,
      stopPropagation: true,
      accepted: true,
    });
    expect(routeCanvasEvent([page], sectionItem).accepted?.parentKind).toBe("page");
  });

  it("does not let a nested column accept a row; the section does", () => {
    const insert = vi.fn();
    const path = [
      { parentId: "col-1", parentKind: "column" as const, index: 0 },
      { parentId: "row-1", parentKind: "row" as const, index: 0 },
      { parentId: "section-1", parentKind: "section" as const, index: 0 },
      { parentId: "page-1", parentKind: "page" as const, index: 0 },
    ];
    expect(canvasDragEventFlags(path[0]!, rowItem).accepted).toBe(false);
    expect(canvasDragEventFlags(path[0]!, rowItem).stopPropagation).toBe(false);
    const routed = routeCanvasEvent(path, rowItem);
    expect(routed.accepted?.parentKind).toBe("section");
    expect(routed.stoppedAt).toBe("section-1");
    simulateCanvasInteraction(path, rowItem, insert);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ parentKind: "section" }), rowItem);
  });

  it("accepts an element drop on a column", () => {
    const column = { parentId: "col-1", parentKind: "column" as const, index: 0 };
    expect(canvasDragEventFlags(column, elementItem)).toEqual({
      preventDefault: true,
      stopPropagation: true,
      accepted: true,
    });
  });

  it("validates palette payloads and lists only compatible targets", () => {
    expect(parsePalettePayload('{"source":"section","preset":"hero"}')).toEqual(sectionItem);
    expect(parsePalettePayload('{"source":"section","preset":"nope"}')).toBeNull();
    expect(parsePalettePayload('{"source":"element","type":"alert"}')).toBeNull();
    expect(parsePalettePayload("not-json")).toBeNull();
    expect(parsePalettePayload({ source: "row", columns: 2 })).toEqual(rowItem);
    expect(compatibleTargetKinds(sectionItem)).toEqual(["page"]);
    expect(compatibleTargetKinds(rowItem)).toEqual(["section"]);
    expect(compatibleTargetKinds(elementItem)).toEqual(["column"]);
    expect(paletteItemLabel(sectionItem)).toBe("Add hero section");
  });

  it("inserts against actual child midpoints instead of even-span heuristics", () => {
    const children = [
      { start: 0, end: 40 },
      { start: 40, end: 120 },
    ];
    expect(dropIndexFromMidpoints(children, 10)).toBe(0);
    expect(dropIndexFromMidpoints(children, 25)).toBe(1);
    expect(dropIndexFromMidpoints(children, 90)).toBe(2);
    expect(dropIndexFromMidpoints([], 50)).toBe(0);
    expect(pointerDragStarted(0, 0, 3, 3)).toBe(false);
    expect(pointerDragStarted(0, 0, 6, 0)).toBe(true);
    const horizontalColumns = [
      { left: 0, width: 100, top: 0, height: 400 },
      { left: 100, width: 200, top: 0, height: 400 },
    ];
    expect(dropIndexFromChildRects(horizontalColumns, { x: 25, y: 200 }, "horizontal")).toBe(0);
    expect(dropIndexFromChildRects(horizontalColumns, { x: 75, y: 200 }, "horizontal")).toBe(1);
    expect(dropIndexFromChildRects(horizontalColumns, { x: 250, y: 200 }, "horizontal")).toBe(2);
  });

  it("moves existing nodes across valid parents and reorders with keyboard arrows", () => {
    let state = createStudioState(createDocumentFromFixture(4, "move-nodes"));
    const page = state.document.graph.pages.landing;
    const first = page.sections[0]!;
    const beforeOrder = page.sections.map(section => section.id);
    state = insertPaletteOnCanvas(state, { source: "section", preset: "cta" });
    const added = state.document.graph.pages.landing.sections.at(-1)!;
    state = moveStudioNode(state, first.id, { parentId: page.id, parentKind: "page", index: state.document.graph.pages.landing.sections.length });
    expect(state.document.graph.pages.landing.sections.map(section => section.id)).toEqual([...beforeOrder.slice(1), added.id, first.id]);

    const row = first.rows[0]!;
    const otherSection = state.document.graph.pages.landing.sections[0]!;
    state = moveStudioNode(state, row.id, { parentId: otherSection.id, parentKind: "section", index: otherSection.rows.length });
    expect(state.document.graph.pages.landing.sections[0]!.rows.some(entry => entry.id === row.id)).toBe(true);

    const element = otherSection.rows[0]!.columns[0]!.elements[0]!;
    const column = otherSection.rows[0]!.columns[0]!;
    const before = column.elements.map(entry => entry.id);
    state = { ...state, selectedId: element.id };
    const target = siblingIndexTarget(state.document.graph, element.id, 1);
    if (target && before.length > 1) {
      state = studioHotkey(state, "ArrowDown", {});
      expect(state.document.graph.pages.landing.sections[0]!.rows[0]!.columns[0]!.elements[1]?.id === element.id || before.length === 1).toBe(true);
    }

    const canvas = renderFunnelCanvas(state.document.graph, { stepKey: "landing", breakpoint: "desktop" });
    const kinds = flattenCanvas(canvas).map(box => box.kind);
    expect(kinds).toContain("section");
    expect(compatibleTargetKinds({ type: "node", id: first.id, nodeKind: "section" })).toEqual(["page"]);
  });

  it("rejects extracting the sole column from a row", () => {
    let state = createStudioState(createDocumentFromFixture(4, "sole-column"));
    let section = state.document.graph.pages.landing.sections[0]!;
    state = insertPaletteOnCanvas({ ...state, selectedId: section.id }, { source: "row", columns: 1 });
    section = state.document.graph.pages.landing.sections[0]!;
    const source = section.rows.find(row => row.columns.length === 1)!;
    const target = section.rows.find(row => row.id !== source.id)!;
    expect(canMoveNodeTo(state.document.graph, source.columns[0]!.id, {
      parentId: target.id,
      parentKind: "row",
      index: target.columns.length,
    })).toBe(false);
  });
});
