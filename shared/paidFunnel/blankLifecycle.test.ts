import { describe, expect, it } from "vitest";
import {
  assembleStudioGraph,
  persistGraphInput,
  studioToPersistSteps,
  studioToStorageGraph,
} from "./persist";
import {
  commitAutosave,
  createBlankDocument,
  createDocumentFromPersist,
  createStudioState,
  insertPaletteOnCanvas,
} from "./store";
import { createGenericPaidFunnelFixture } from "./fixture";

describe("blank paid-funnel lifecycle", () => {
  it("starts empty, edits, persists, and reloads without cloning a template", () => {
    const document = createBlankDocument(5, "Northland Spas Funnel", "northland-funnel");
    expect(document.graph.steps).toHaveLength(1);
    expect(document.graph.steps[0]?.key).toBe("landing");
    expect(document.graph.pages.landing.sections).toEqual([]);
    expect(document.graph.steps.map(step => step.key)).not.toEqual(
      createGenericPaidFunnelFixture("northland").steps.map(step => step.key),
    );

    let state = createStudioState({
      ...document,
      funnelId: 44,
      stepId: 90,
      expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
    });
    expect(state.stepKey).toBe("landing");
    expect(state.selectedId).toBe(document.graph.pages.landing.id);

    state = insertPaletteOnCanvas(state, { source: "section", preset: "hero" });
    expect(state.document.saveStatus).toBe("saving");
    expect(state.document.graph.pages.landing.sections).toHaveLength(1);
    expect(state.document.graph.pages.landing.sections[0]?.preset).toBe("hero");

    const storage = persistGraphInput(studioToStorageGraph(state.document.graph));
    expect(storage.pages).toHaveLength(1);
    expect(storage.pages[0]?.sections).toHaveLength(1);

    const saved = assembleStudioGraph({
      funnel: { id: 44, name: "Northland Spas Funnel", slug: "northland-funnel" },
      steps: studioToPersistSteps(state.document.graph).map((step, index) => ({
        id: 90 + index,
        ...step,
      })),
      graphs: [
        {
          stepId: 90,
          updatedAt: "2026-08-18T12:00:01.000Z",
          graph: storage,
        },
      ],
    });
    expect(saved.graph.pages.landing.sections).toHaveLength(1);

    const reloaded = createStudioState(
      createDocumentFromPersist({
        clientId: 5,
        funnelId: 44,
        stepId: saved.stepId,
        expectedUpdatedAt: saved.expectedUpdatedAt,
        graph: saved.graph,
      }),
    );
    expect(reloaded.document.graph.pages.landing.sections[0]?.preset).toBe("hero");
    expect(reloaded.document.graph.steps).toHaveLength(1);
    expect(reloaded.document.saveStatus).toBe("saved");

    const afterSave = commitAutosave(state, state.document.revision, {
      expectedUpdatedAt: saved.expectedUpdatedAt.toISOString(),
      stepId: saved.stepId,
    }, state.document.editSeq);
    expect(afterSave.document.saveStatus).toBe("saved");
    expect(afterSave.document.funnelId).toBe(44);
  });
});
