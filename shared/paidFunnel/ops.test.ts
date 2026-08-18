import { describe, expect, it } from "vitest";
import { createEmptyGraph, createIdFactory, findNode, PAID_FUNNEL_KIND } from "./graph";
import {
  deleteNode,
  dropTargetsForItem,
  duplicateNode,
  insertPaletteItem,
  isValidDrop,
  reorderNode,
  resizeColumns,
  saveReusableSection,
  setButtonAction,
  setInlineText,
  setResponsiveSpacing,
  setVisibility,
} from "./ops";
import { attachMedia } from "./ops";
import { createSectionPreset } from "./presets";

function seed() {
  const nextId = createIdFactory("t");
  let graph = createEmptyGraph({ funnelKey: "test", name: "Test", nextId });
  graph = insertPaletteItem(graph, { parentId: graph.pages.landing.id, parentKind: "page", index: 0 }, { source: "section", preset: "hero" }, createSectionPreset, nextId);
  return { graph, nextId };
}

describe("paid funnel graph hierarchy", () => {
  it("is a paid-funnel Page -> Section -> Row -> Column -> Element graph", () => {
    const { graph } = seed();
    expect(graph.kind).toBe(PAID_FUNNEL_KIND);
    const page = graph.pages.landing;
    expect(page.kind).toBe("page");
    expect(page.sections[0]?.kind).toBe("section");
    expect(page.sections[0]?.rows[0]?.kind).toBe("row");
    expect(page.sections[0]?.rows[0]?.columns[0]?.kind).toBe("column");
    expect(page.sections[0]?.rows[0]?.columns[0]?.elements[0]?.kind).toBe("element");
  });

  it("only allows sections on pages, rows on sections, and elements on columns", () => {
    const { graph } = seed();
    const page = graph.pages.landing;
    const section = page.sections[0]!;
    const column = section.rows[0]!.columns[0]!;
    expect(isValidDrop({ parentId: page.id, parentKind: "page", index: 0 }, { source: "section", preset: "cta" })).toBe(true);
    expect(isValidDrop({ parentId: section.id, parentKind: "section", index: 0 }, { source: "row", columns: 2 })).toBe(true);
    expect(isValidDrop({ parentId: column.id, parentKind: "column", index: 0 }, { source: "element", type: "button" })).toBe(true);
    expect(isValidDrop({ parentId: column.id, parentKind: "column", index: 0 }, { source: "section", preset: "hero" })).toBe(false);
    expect(dropTargetsForItem(graph, "landing", { source: "section", preset: "faq" }).every(target => target.parentKind === "page")).toBe(true);
  });

  it("reorders, resizes columns, duplicates, and deletes with undoable structure", () => {
    const { graph, nextId } = seed();
    const page = graph.pages.landing;
    let next = insertPaletteItem(graph, { parentId: page.id, parentKind: "page", index: 1 }, { source: "section", preset: "cta" }, createSectionPreset, nextId);
    const first = next.pages.landing.sections[0]!.id;
    const second = next.pages.landing.sections[1]!.id;
    next = reorderNode(next, second, 0);
    expect(next.pages.landing.sections.map(section => section.id)).toEqual([second, first]);
    const rowId = next.pages.landing.sections[1]!.rows[0]!.id;
    next = insertPaletteItem(next, { parentId: next.pages.landing.sections[1]!.id, parentKind: "section", index: 0 }, { source: "row", columns: 2 }, createSectionPreset, nextId);
    const twoCol = next.pages.landing.sections[1]!.rows[0]!;
    next = resizeColumns(next, twoCol.id, [70, 30], "desktop");
    expect(next.pages.landing.sections[1]!.rows[0]!.columns.map(column => column.widths.desktop)).toEqual([70, 30]);
    next = resizeColumns(next, twoCol.id, [50, 50], "tablet");
    expect(findNode(next, twoCol.id)?.node.kind).toBe("row");
    const duplicated = duplicateNode(next, second, nextId);
    expect(duplicated.pages.landing.sections.length).toBe(next.pages.landing.sections.length + 1);
    const deleted = deleteNode(duplicated, second);
    expect(deleted.pages.landing.sections.find(section => section.id === second)).toBeUndefined();
    expect(rowId).toBeTruthy();
  });

  it("supports inline text, media flow, button actions, and persisted responsive overrides", () => {
    const { graph } = seed();
    const heading = graph.pages.landing.sections[0]!.rows[0]!.columns[0]!.elements.find(el => el.type === "heading")!;
    const button = graph.pages.landing.sections[0]!.rows[0]!.columns[0]!.elements.find(el => el.type === "button")!;
    let next = setInlineText(graph, heading.id, "Memorial Day spa sale");
    expect((findNode(next, heading.id)?.node as { props: { text: string } }).props.text).toBe("Memorial Day spa sale");
    next = setButtonAction(next, button.id, { type: "url", href: "https://example.com/book", openInNewTab: true });
    expect((findNode(next, button.id)?.node as { props: { action: { type: string } } }).props.action.type).toBe("url");
    const image = graph.pages.landing.sections[0]!.id;
    next = attachMedia(next, image, { url: "https://cdn.example.com/hero.jpg", filename: "hero.jpg", assetId: "asset-1" });
    const section = findNode(next, image)?.node as { background: { kind: string; filename?: string } };
    expect(section.background.kind).toBe("image");
    expect(section.background.filename).toBe("hero.jpg");
    next = setResponsiveSpacing(next, heading.id, "padding", "mobile", { top: 8, right: 8, bottom: 8, left: 8 });
    const styles = (findNode(next, heading.id)?.node as { styles: { padding: { mobile: { top: number } } } }).styles;
    expect(styles.padding.mobile.top).toBe(8);
    next = setVisibility(next, heading.id, { desktop: true, tablet: true, mobile: false });
    expect((findNode(next, heading.id)?.node as { visibility: { mobile: boolean } }).visibility.mobile).toBe(false);
  });

  it("saves reusable sections for use across funnels", () => {
    const { graph, nextId } = seed();
    const sectionId = graph.pages.landing.sections[0]!.id;
    const next = saveReusableSection(graph, sectionId, "Hero offer", "2026-08-18T00:00:00.000Z", nextId);
    expect(next.reusableSections[0]?.name).toBe("Hero offer");
    expect(next.reusableSections[0]?.section.preset).toBe("hero");
  });
});
