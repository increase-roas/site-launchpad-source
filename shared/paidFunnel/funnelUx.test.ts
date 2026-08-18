import { describe, expect, it } from "vitest";
import { flattenCanvas, renderFunnelCanvas } from "./canvas";
import {
  CANONICAL_OFFLINE_CONVERSION_CONTRACT,
  LIGHT_FUNNEL_THEME_PRESET,
  findNode,
  migratePaidFunnelGraph,
  stepHasLeadForm,
} from "./graph";
import { inspectorModel } from "./inspector";
import {
  applyGlobalStyles,
  nextStepKey,
  saveReusableSection,
  setInlineText,
  setResponsiveSpacing,
} from "./ops";
import {
  createGenericPaidFunnelFixture,
  GENERIC_PAID_FUNNEL_PACKAGE,
} from "./fixture";
import { paidAdPalette, PAID_ADS_SECTION_PRESET_LABELS } from "./presets";
import {
  applyGraph,
  commitAutosave,
  createDocumentFromFixture,
  createStudioState,
  studioHotkey,
} from "./store";

describe("generic multi-step paid funnel UX", () => {
  it("ships every paid-ad section preset and a complete opt-in/survey/form funnel", () => {
    const graph = createGenericPaidFunnelFixture();
    expect(Object.keys(PAID_ADS_SECTION_PRESET_LABELS)).toEqual([
      "blank",
      "full-width",
      "boxed",
      "hero",
      "image-choice-hero",
      "numbered-steps",
      "two-column",
      "three-column",
      "form",
      "testimonial",
      "faq",
      "cta",
      "pricing",
      "footer",
    ]);
    expect(paidAdPalette().elements).toHaveLength(19);
    expect(graph.steps.map(step => step.type)).toEqual([
      "landing",
      "survey",
      "survey",
      "form",
      "thankYou",
    ]);
    expect(graph.steps.map(step => step.slug)).toEqual([
      "/",
      "/survey/homeowner",
      "/survey/timeline",
      "/contact",
      "/thank-you",
    ]);
    expect(nextStepKey(graph, "landing")).toBe("survey-homeowner");
    expect(nextStepKey(graph, "survey-homeowner")).toBe("survey-timeline");
    expect(nextStepKey(graph, "form")).toBe("thankYou");
    expect(stepHasLeadForm(graph, "form")).toBe(true);
    expect(GENERIC_PAID_FUNNEL_PACKAGE.kind).toBe("paid-funnel");
    expect(GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract).toEqual(
      CANONICAL_OFFLINE_CONVERSION_CONTRACT
    );
    expect(GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract.joinKey).toBe(
      "leadUuid"
    );
    expect(
      GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract.purchase
        .requiresExplicitPositiveValue
    ).toBe(true);
  });

  it("renders a real nested canvas per step, not a flat block list", () => {
    const graph = createGenericPaidFunnelFixture();
    const landing = renderFunnelCanvas(graph, {
      stepKey: "landing",
      breakpoint: "desktop",
    });
    const form = renderFunnelCanvas(graph, {
      stepKey: "form",
      breakpoint: "desktop",
    });
    expect(landing?.kind).toBe("page");
    expect(landing?.children[0]?.kind).toBe("section");
    expect(landing?.children[0]?.children[0]?.kind).toBe("row");
    expect(landing?.children[0]?.children[0]?.children[0]?.kind).toBe("column");
    expect(
      landing?.children[0]?.children[0]?.children[0]?.children[0]?.kind
    ).toBe("element");
    const landingLabels = flattenCanvas(landing)
      .filter(box => box.kind === "element")
      .map(box => box.label);
    const formLabels = flattenCanvas(form)
      .filter(box => box.kind === "element")
      .map(box => box.label);
    expect(landingLabels).toContain("heading");
    expect(landingLabels).toContain("button");
    expect(formLabels).toContain("form");
    expect(
      flattenCanvas(
        renderFunnelCanvas(graph, {
          stepKey: "survey-homeowner",
          breakpoint: "desktop",
        })
      ).map(box => box.label)
    ).toContain("multipleChoice");
    expect(landingLabels.join(",")).not.toBe(formLabels.join(","));
  });

  it("exposes full inspector controls and applies global styles plus per-node responsive overrides", () => {
    const graph = createGenericPaidFunnelFixture();
    const section = graph.pages.landing.sections[0]!;
    const row = section.rows[0]!;
    const column = row.columns[0]!;
    const element = column.elements[0]!;
    expect(inspectorModel(graph, section.id, "desktop")?.controls).toEqual(
      expect.arrayContaining([
        "layout",
        "maxWidth",
        "minHeight",
        "alignment",
        "padding",
        "margin",
        "background",
        "overlay",
        "border",
        "radius",
        "shadow",
        "sticky",
        "anchor",
        "className",
        "visibility",
        "duplicate",
        "saveReusable",
        "delete",
      ])
    );
    expect(inspectorModel(graph, row.id, "desktop")?.controls).toEqual(
      expect.arrayContaining([
        "gap",
        "valign",
        "wrap",
        "background",
        "padding",
        "columns",
      ])
    );
    expect(inspectorModel(graph, column.id, "tablet")?.controls).toEqual(
      expect.arrayContaining([
        "width",
        "alignment",
        "padding",
        "background",
        "border",
        "visibility",
        "elementOrder",
      ])
    );
    expect(inspectorModel(graph, element.id, "mobile")?.controls).toEqual(
      expect.arrayContaining([
        "typography",
        "elementSize",
        "spacing",
        "margin",
        "background",
        "color",
        "border",
        "radius",
        "shadow",
        "alignment",
        "link",
        "action",
        "responsive",
        "visibility",
        "duplicate",
        "delete",
      ])
    );
    const restyled = applyGlobalStyles(graph, {
      fonts: { heading: "Oswald", body: "Inter" },
      button: { ...graph.globalStyles.button, background: "#f97316" },
    });
    expect(restyled.globalStyles.fonts.heading).toBe("Oswald");
    const withPad = setResponsiveSpacing(
      restyled,
      section.id,
      "padding",
      "mobile",
      { top: 12, right: 10, bottom: 12, left: 10 }
    );
    const mobile = renderFunnelCanvas(withPad, {
      stepKey: "landing",
      breakpoint: "mobile",
    });
    expect(String(mobile?.children[0]?.style.padding)).toContain("12px");
  });

  it("applies a readable light theme without replacing block-level overrides", () => {
    const graph = createGenericPaidFunnelFixture();
    const section = graph.pages.landing.sections[0]!;
    const heading = section.rows[0]!.columns[0]!.elements.find(
      element => element.type === "heading"
    )!;
    section.background = { kind: "color", color: "#fff7ed" };
    heading.styles.color = "#7c2d12";

    const themed = applyGlobalStyles(graph, {
      colors: { ...LIGHT_FUNNEL_THEME_PRESET.colors },
      button: {
        ...graph.globalStyles.button,
        ...LIGHT_FUNNEL_THEME_PRESET.button,
      },
    });
    const canvas = renderFunnelCanvas(themed, {
      stepKey: "landing",
      breakpoint: "desktop",
    });
    const headingBox = flattenCanvas(canvas).find(box => box.id === heading.id);

    expect(themed.globalStyles.colors).toMatchObject({
      background: "#ffffff",
      heading: "#0f172a",
      text: "#1e293b",
    });
    expect(canvas?.children[0]?.style.background).toBe("#fff7ed");
    expect(headingBox?.style.color).toBe("#7c2d12");
  });

  it("autosaves, detects revision conflicts, and undoes structural plus property edits", () => {
    let state = createStudioState(createDocumentFromFixture(9, "client-9"));
    const heading =
      state.document.graph.pages.landing.sections[0]!.rows[0]!.columns[0]!.elements.find(
        el => el.type === "heading"
      )!;
    state = applyGraph(
      state,
      setInlineText(state.document.graph, heading.id, "Edited headline")
    );
    expect(state.document.saveStatus).toBe("saving");
    state = commitAutosave(state, 1);
    expect(state.document.saveStatus).toBe("saved");
    expect(state.document.revision).toBe(2);
    const conflicted = commitAutosave(state, 1);
    expect(conflicted.document.conflict).toBe(true);
    state = studioHotkey(state, "z", { meta: true });
    const undone = findNode(state.document.graph, heading.id)?.node as {
      props: { text: string };
    };
    expect(undone.props.text).not.toBe("Edited headline");
    state = studioHotkey(state, "z", { meta: true, shift: true });
    const redone = findNode(state.document.graph, heading.id)?.node as {
      props: { text: string };
    };
    expect(redone.props.text).toBe("Edited headline");
  });

  it("migrates only versioned paid-funnel graphs and rejects website block lists", () => {
    const graph = createGenericPaidFunnelFixture();
    expect(migratePaidFunnelGraph(graph).schemaVersion).toBe(1);
    expect(() =>
      migratePaidFunnelGraph({ schemaVersion: 0, blocks: [{ type: "hero" }] })
    ).toThrow(/block lists/);
    const reused = saveReusableSection(
      graph,
      graph.pages.landing.sections[0]!.id,
      "Shared hero"
    );
    expect(reused.reusableSections).toHaveLength(1);
  });
});
