import { describe, expect, it } from "vitest";
import {
  PAID_FUNNEL_ELEMENT_TYPES,
  PAID_FUNNEL_SECTION_PRESETS,
  migratePaidFunnelGraph,
  paidFunnelGraphSchema,
} from "./paidFunnelGraph";

const validGraph = {
  version: 1 as const,
  pages: [
    {
      id: "page-landing",
      stepKey: "landing",
      sections: [
        {
          id: "section-hero",
          preset: "hero" as const,
          rows: [
            {
              id: "row-hero",
              columns: [
                {
                  id: "col-hero",
                  width: { desktop: 12 },
                  elements: [
                    {
                      id: "el-heading",
                      type: "heading" as const,
                      props: { text: "Hello" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("paid funnel content graph", () => {
  it("accepts a versioned page-section-row-column-element graph", () => {
    expect(paidFunnelGraphSchema.parse(validGraph).pages).toHaveLength(1);
    expect(PAID_FUNNEL_ELEMENT_TYPES).toContain("form");
    expect(PAID_FUNNEL_SECTION_PRESETS).toContain("pricing");
    const migrated = paidFunnelGraphSchema.parse(validGraph);
    expect(migrated.pages[0]?.kind).toBe("page");
    expect(migrated.pages[0]?.sections[0]?.kind).toBe("section");
    expect(migrated.pages[0]?.sections[0]?.rows[0]?.kind).toBe("row");
    expect(migrated.pages[0]?.sections[0]?.rows[0]?.columns[0]?.kind).toBe("column");
    expect(migrated.pages[0]?.sections[0]?.rows[0]?.columns[0]?.elements[0]?.kind).toBe("element");
  });

  it("migrates builder pages records into the same versioned array graph", () => {
    const builderShaped = {
      schemaVersion: 1,
      kind: "paid-funnel",
      funnelKey: "demo",
      name: "Demo",
      version: 1,
      pages: {
        landing: validGraph.pages[0],
      },
    };
    const migrated = migratePaidFunnelGraph(builderShaped);
    expect(migrated.pages).toHaveLength(1);
    expect(migrated.pages[0]?.id).toBe("page-landing");
    expect(migrated.funnelKey).toBe("demo");
  });

  it("rejects duplicate stable ids", () => {
    const duplicate = structuredClone(validGraph);
    duplicate.pages[0].sections[0].rows[0].columns[0].elements.push({
      id: "el-heading",
      type: "text",
      props: { text: "dup" },
    });
    expect(() => paidFunnelGraphSchema.parse(duplicate)).toThrow(
      /Duplicate stable id/
    );
  });

  it("migrates version 0 graphs to version 1", () => {
    const { version: _version, ...unversioned } = validGraph;
    expect(migratePaidFunnelGraph(unversioned).version).toBe(1);
  });

  it("rejects unknown future graph versions", () => {
    expect(() => migratePaidFunnelGraph({ ...validGraph, version: 9 })).toThrow(
      /Unsupported paid funnel graph version 9/
    );
  });
});
