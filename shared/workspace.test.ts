import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_SITE_PAGES,
  FUNNEL_SHAPES,
  sectionOrderSchema,
} from "./workspace";

describe("workspace defaults", () => {
  it("defines the five required website page cards", () => {
    expect(DEFAULT_SITE_PAGES.map(page => page.pageType)).toEqual([
      "homepage",
      "inventory",
      "categories",
      "visitUs",
      "financing",
    ]);
  });

  it("preserves the exact required Shape A, B, and C flows", () => {
    expect(FUNNEL_SHAPES.A.map(step => step.stepType)).toEqual(["zip", "thankYou"]);
    expect(FUNNEL_SHAPES.B.map(step => step.stepType)).toEqual([
      "zip",
      "survey",
      "contact",
      "thankYou",
    ]);
    expect(FUNNEL_SHAPES.C.map(step => step.stepType)).toEqual([
      "zip",
      "survey",
      "contact",
      "book",
      "thankYou",
    ]);
  });

  it("includes all homepage sections and keeps testimonials off until approved content exists", () => {
    expect(DEFAULT_HOMEPAGE_SECTIONS).toHaveLength(9);
    expect(DEFAULT_HOMEPAGE_SECTIONS.find(section => section.sectionType === "testimonials"))
      .toMatchObject({ enabled: 0 });
  });

  it("accepts one ordered entry per homepage section and rejects duplicates", () => {
    const valid = DEFAULT_HOMEPAGE_SECTIONS.map((section, index) => ({
      id: index + 1,
      sectionType: section.sectionType,
      enabled: Boolean(section.enabled),
    }));
    expect(sectionOrderSchema.safeParse(valid).success).toBe(true);
    expect(sectionOrderSchema.safeParse([...valid.slice(0, 8), valid[0]]).success).toBe(false);
  });
});
