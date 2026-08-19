import { describe, expect, it } from "vitest";
import { createEmptyGraph } from "./graph";
import { studioToPersistSteps } from "./persist";
import {
  addBlankPage,
  deletePageSafely,
  duplicatePage,
  renamePage,
  reorderPages,
  setPageNext,
  setPageSlug,
  uniquePageSlug,
} from "./pageManager";

describe("page manager", () => {
  it("adds blank pages with unique keys and URLs", () => {
    const blank = createEmptyGraph({ funnelKey: "blank", name: "Blank" });
    const first = addBlankPage(blank, { title: "Offer" });
    expect(first.graph.steps).toHaveLength(2);
    expect(first.graph.pages[first.stepKey]?.sections).toEqual([]);
    expect(first.graph.steps[0]?.nextStep).toEqual({ type: "step", stepKey: first.stepKey });
    const second = addBlankPage(first.graph, { title: "Offer" });
    expect(second.graph.steps.map(step => step.key)).toEqual(
      expect.arrayContaining(["landing", first.stepKey, second.stepKey]),
    );
    expect(new Set(second.graph.steps.map(step => step.slug)).size).toBe(3);
    expect(studioToPersistSteps(second.graph)).toHaveLength(3);
  });

  it("renames, uniquifies URLs, and configures next-page or redirect", () => {
    let graph = createEmptyGraph({ funnelKey: "blank", name: "Blank" });
    const added = addBlankPage(graph, { title: "Thanks" });
    graph = renamePage(added.graph, added.stepKey, "Thank you");
    expect(graph.steps.find(step => step.key === added.stepKey)?.title).toBe("Thank you");
    graph = setPageSlug(graph, added.stepKey, "/");
    expect(graph.steps.find(step => step.key === added.stepKey)?.slug).not.toBe("/");
    expect(uniquePageSlug(graph, "/", "landing")).toBe("/");
    graph = setPageNext(graph, "landing", { type: "step", stepKey: added.stepKey });
    graph = setPageNext(graph, added.stepKey, { type: "redirect", url: "https://example.com/book" });
    expect(graph.steps.find(step => step.key === "landing")?.nextStep).toEqual({
      type: "step",
      stepKey: added.stepKey,
    });
    expect(graph.steps.find(step => step.key === added.stepKey)?.nextStep).toEqual({
      type: "redirect",
      url: "https://example.com/book",
    });
  });

  it("reorders, duplicates, and refuses deleting the last page", () => {
    let graph = createEmptyGraph({ funnelKey: "blank", name: "Blank" });
    const offer = addBlankPage(graph, { title: "Offer" });
    graph = offer.graph;
    const thanks = addBlankPage(graph, { title: "Thanks" });
    graph = thanks.graph;
    graph = reorderPages(graph, 2, 1);
    expect(graph.steps.map(step => step.title)).toEqual(["Landing", "Thanks", "Offer"]);
    const copy = duplicatePage(graph, offer.stepKey);
    expect(copy.graph.steps).toHaveLength(4);
    expect(copy.graph.pages[copy.stepKey]?.id).not.toBe(copy.graph.pages[offer.stepKey]?.id);
    const removed = deletePageSafely(copy.graph, offer.stepKey);
    expect(removed.graph.steps.some(step => step.key === offer.stepKey)).toBe(false);
    expect(removed.graph.steps.some(step => step.nextStep.type === "step" && step.nextStep.stepKey === offer.stepKey)).toBe(false);
    const last = createEmptyGraph({ funnelKey: "solo", name: "Solo" });
    expect(() => deletePageSafely(last, "landing")).toThrow(/at least one page/i);
  });
});
