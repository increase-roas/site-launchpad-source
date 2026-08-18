import { describe, expect, it } from "vitest";
import {
  PAID_FUNNEL_ELEMENT_TYPES,
  PAID_FUNNEL_KIND,
  PAID_FUNNEL_SECTION_PRESETS,
  PAID_FUNNEL_STEP_TYPES,
  createEmptyGraph,
  createIdFactory,
  migratePaidFunnelGraph,
} from "./graph";

describe("paid funnel graph model", () => {
  it("uses paid-funnel kind and the required step types", () => {
    const graph = createEmptyGraph({ funnelKey: "demo", name: "Demo", nextId: createIdFactory("g") });
    expect(graph.kind).toBe(PAID_FUNNEL_KIND);
    expect(graph.kind).not.toBe("website");
    expect(PAID_FUNNEL_STEP_TYPES).toEqual(["landing", "form", "thankYou", "booking", "upsell"]);
    expect(PAID_FUNNEL_ELEMENT_TYPES).toContain("form");
    expect(PAID_FUNNEL_ELEMENT_TYPES).toContain("phoneCta");
    expect(PAID_FUNNEL_SECTION_PRESETS).toContain("hero");
    expect(graph.schemaVersion).toBe(1);
  });

  it("keeps unique stable ids on page/section/row/column/element", () => {
    const graph = createEmptyGraph({ funnelKey: "ids", name: "Ids", nextId: createIdFactory("id") });
    expect(graph.pages.landing.id).toBe("id_1");
    expect(new Set([graph.pages.landing.id, graph.funnelKey]).size).toBe(2);
  });

  it("migrates schemaVersion 0 objects that already have pages", () => {
    const current = createEmptyGraph({ funnelKey: "m", name: "Migrate", nextId: createIdFactory("m") });
    const { schemaVersion: _drop, ...rest } = current;
    const migrated = migratePaidFunnelGraph({ ...rest, schemaVersion: 0 });
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.kind).toBe("paid-funnel");
  });

  it("rejects website block lists and foreign kinds", () => {
    expect(() => migratePaidFunnelGraph({ schemaVersion: 0, blocks: [] })).toThrow(/website/i);
    expect(() => migratePaidFunnelGraph({ schemaVersion: 1, kind: "website", pages: {} })).toThrow(/paid-funnel/);
  });
});
