import { describe, expect, it } from "vitest";
import { ASTRO_SECTION_TYPE_VALUES, createAstroHomepageSection } from "@shared/astroConfig";
import { SECTION_FIELD_GROUPS, sectionPreviewTitle } from "./sectionFieldModel";

describe("sectionFieldModel", () => {
  it("defines editor groups for every homepage section type", () => {
    for (const type of ASTRO_SECTION_TYPE_VALUES) {
      expect(SECTION_FIELD_GROUPS[type].length).toBeGreaterThan(0);
    }
  });

  it("prefers a written headline over the empty fallback", () => {
    const section = createAstroHomepageSection("hero");
    expect(sectionPreviewTitle(section)).toBe("");
    expect(sectionPreviewTitle({ ...section, fields: { ...section.fields, headline: "Labor Day sale" } })).toBe(
      "Labor Day sale",
    );
  });
});
