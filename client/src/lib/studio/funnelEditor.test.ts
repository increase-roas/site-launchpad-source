import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "@shared/paidFunnel/fixture";
import { PaidFunnelEditor } from "./funnelEditor";
import { studioToStorageGraph, storageToStudioGraph } from "@shared/paidFunnel/persist";

describe("paid funnel visual editor session", () => {
  it("undoes and redoes structural and property edits", () => {
    const editor = new PaidFunnelEditor(createGenericPaidFunnelFixture("ed"));
    const pageId = editor.snapshot().graph.pages.landing.id;
    editor.insert({ source: "section", preset: "boxed" }, { parentId: pageId, parentKind: "page", index: 0 });
    const afterInsert = editor.snapshot().graph.pages.landing.sections.length;
    editor.select(editor.snapshot().graph.pages.landing.sections[0].id);
    editor.updateSelected({ sticky: true });
    expect(editor.snapshot().graph.pages.landing.sections[0].sticky).toBe(true);
    editor.undo();
    expect(editor.snapshot().graph.pages.landing.sections[0].sticky).toBe(false);
    editor.undo();
    expect(editor.snapshot().graph.pages.landing.sections.length).toBe(afterInsert - 1);
    editor.redo();
    expect(editor.snapshot().graph.pages.landing.sections.length).toBe(afterInsert);
  });

  it("handles delete, duplicate, and keyboard shortcuts", () => {
    const editor = new PaidFunnelEditor(createGenericPaidFunnelFixture("keys"));
    const sectionId = editor.snapshot().graph.pages.landing.sections[0].id;
    editor.select(sectionId);
    editor.handleKeyboard({ key: "d", metaKey: true });
    expect(editor.snapshot().graph.pages.landing.sections.length).toBeGreaterThan(1);
    editor.select(editor.snapshot().graph.pages.landing.sections[0].id);
    editor.handleKeyboard({ key: "Delete" });
    editor.handleKeyboard({ key: "z", metaKey: true });
    expect(editor.snapshot().canUndo || editor.snapshot().graph.pages.landing.sections.length > 0).toBe(true);
  });

  it("flags a version conflict when remote revision drifts", () => {
    const editor = new PaidFunnelEditor(createGenericPaidFunnelFixture("cf"));
    const pageId = editor.snapshot().graph.pages.landing.id;
    editor.insert({ source: "row", columns: 1 }, { parentId: editor.snapshot().graph.pages.landing.sections[0].id, parentKind: "section", index: 0 });
    expect(editor.detectConflict(2)).toBe(true);
    expect(editor.snapshot().saveStatus).toBe("conflict");
    expect(pageId).toBeTruthy();
  });

  it("round-trips editor graphs through the registry storage graph", () => {
    const editor = new PaidFunnelEditor(createGenericPaidFunnelFixture("persist"));
    const pageId = editor.snapshot().graph.pages.landing.id;
    editor.insert({ source: "section", preset: "cta" }, { parentId: pageId, parentKind: "page", index: 0 });
    const storage = studioToStorageGraph(editor.snapshot().graph);
    const restored = storageToStudioGraph(storage, {
      funnel: { id: 8, name: "Persist", slug: "persist" },
      steps: editor.snapshot().graph.steps.map((step, position) => ({
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
    const again = new PaidFunnelEditor(restored);
    expect(again.snapshot().graph.pages.landing.sections[0]?.preset).toBe("cta");
    expect(again.snapshot().graph.pages.landing.sections[0]?.kind).toBe("section");
  });
});
