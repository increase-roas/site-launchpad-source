import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "./fixture";
import { createEmptyGraph, PAID_FUNNEL_GRAPH_SCHEMA_VERSION, PAID_FUNNEL_KIND } from "./graph";
import { compilePaidFunnelToAstro } from "./astroCompiler";
import { persistGraphInput, studioToStorageGraph } from "./persist";
import {
  applyPuckDataToGraph,
  createBlankPuckData,
  graphSupportsPuck,
  pageToPuckData,
  puckDataFromGraph,
  type PuckAdapterData,
} from "./puckAdapter";

const SAMPLE: PuckAdapterData = {
  content: [
    {
      type: "Section",
      props: {
        id: "Section-1",
        background: "#f8fafc",
        padding: "32px",
        content: [
          {
            type: "Columns",
            props: {
              id: "Columns-1",
              count: "2",
              columns: [
                { type: "Heading", props: { id: "Heading-1", text: "Welcome", level: "h1" } },
                { type: "Text", props: { id: "Text-1", body: "Hello from Puck." } },
                {
                  type: "Image",
                  props: {
                    id: "Image-1",
                    src: "https://placehold.co/600x320/e2e8f0/0f172a?text=Puck",
                    alt: "Placeholder",
                  },
                },
                { type: "Button", props: { id: "Button-1", label: "Get started", href: "#" } },
                {
                  type: "Form",
                  props: {
                    id: "Form-1",
                    title: "Request a callback",
                    submitLabel: "Submit",
                    showPhone: true,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
  root: { props: { title: "Puck page" } },
};

describe("puck adapter", () => {
  it("maps blank puck data onto an empty graph page without changing schema identity", () => {
    const graph = createEmptyGraph({ funnelKey: "blank-1", name: "Blank" });
    expect(graph.schemaVersion).toBe(PAID_FUNNEL_GRAPH_SCHEMA_VERSION);
    expect(graph.kind).toBe(PAID_FUNNEL_KIND);
    expect(graphSupportsPuck(graph)).toBe(true);
    const next = applyPuckDataToGraph(graph, "landing", createBlankPuckData());
    expect(next.pages.landing.sections).toEqual([]);
    expect(next.schemaVersion).toBe(1);
    expect(next.kind).toBe("paid-funnel");
  });

  it("maps nested Puck slots onto Page → Section → Row → Column → Element", () => {
    const graph = applyPuckDataToGraph(
      createEmptyGraph({ funnelKey: "blank-2", name: "Blank" }),
      "landing",
      SAMPLE,
    );
    expect(graphSupportsPuck(graph)).toBe(true);
    const section = graph.pages.landing.sections[0];
    expect(section?.id).toBe("Section-1");
    expect(section?.rows).toHaveLength(1);
    expect(section?.rows[0]?.columns).toHaveLength(2);
    const types = section?.rows[0]?.columns.flatMap(column => column.elements.map(element => element.type));
    expect(types).toEqual(["heading", "image", "form", "text", "button"]);
    const form = section?.rows[0]?.columns.flatMap(column => column.elements).find(element => element.type === "form");
    expect(form?.props.fields).toEqual(["firstName", "lastName", "email", "phone", "consent"]);
    expect(form?.props.submitLabel).toBe("Submit");
    const button = section?.rows[0]?.columns.flatMap(column => column.elements).find(element => element.type === "button");
    expect(button?.props.action).toEqual({ type: "nextStep" });
  });

  it("roundtrips puck-compatible pages and stays persistable", () => {
    const started = applyPuckDataToGraph(
      createEmptyGraph({ funnelKey: "blank-3", name: "Blank" }),
      "landing",
      SAMPLE,
    );
    const puck = puckDataFromGraph(started, "landing");
    const again = applyPuckDataToGraph(started, "landing", puck);
    expect(pageToPuckData(again.pages.landing).content[0]?.type).toBe("Section");
    const storage = persistGraphInput(studioToStorageGraph(again));
    expect(storage.version).toBe(1);
    expect(storage.pages[0]?.sections[0]?.rows[0]?.columns.length).toBeGreaterThan(0);
  });

  it("compiled puck forms keep session lead_uuid and shared event_id", () => {
    const graph = applyPuckDataToGraph(
      createEmptyGraph({ funnelKey: "blank-form", name: "Blank" }),
      "landing",
      SAMPLE,
    );
    const compiled = compilePaidFunnelToAstro(graph);
    const runtime = compiled.map(file => file.contents).join("\n");
    expect(runtime).toContain("lead_uuid");
    expect(runtime).toContain("eventID: event_id");
    expect(runtime).toContain("first_url");
    expect(runtime).toContain('data-funnel-form');
  });

  it("keeps existing template funnels on the current graph path", () => {
    const fixture = createGenericPaidFunnelFixture();
    expect(graphSupportsPuck(fixture)).toBe(false);
    expect(fixture.steps.map(step => step.key)).toContain("form");
  });
});
