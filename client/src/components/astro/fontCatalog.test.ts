import { describe, expect, it } from "vitest";
import { createDefaultAstroConfig } from "@shared/astroConfig";
import { BUSINESS_DAY_VALUES } from "@shared/client";
import {
  FONT_CATALOG,
  fontGroupsForRole,
  fontOptionsForRole,
  fontPreviewStylesheetHref,
  fontSelectionState,
  fontStack,
  isGeneratedFontStylesheetHref,
  siteFontStylesheetHref,
  syncFontStylesheetHref,
} from "./fontCatalog";

/** Every requested weight has to be one the family actually publishes, or css2 400s. */
function requestedWeights(href: string): Array<{ family: string; weights: number[] }> {
  return new URL(href).searchParams.getAll("family").map(segment => {
    const [family, axis = ""] = segment.split(":");
    return {
      family,
      weights: axis
        .replace("wght@", "")
        .split(";")
        .filter(Boolean)
        .map(Number),
    };
  });
}

describe("font catalog", () => {
  it("lists every family exactly once", () => {
    const families = FONT_CATALOG.map(option => option.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it("publishes ascending weights including 400 and 700 for every family", () => {
    for (const option of FONT_CATALOG) {
      expect(option.weights).toEqual([...option.weights].sort((a, b) => a - b));
      expect(new Set(option.weights).size).toBe(option.weights.length);
      expect(option.weights).toContain(400);
      expect(option.weights).toContain(700);
    }
  });

  it("offers sans and serif families for text roles but never monospace", () => {
    const categories = new Set(fontOptionsForRole("text").map(option => option.category));
    expect(categories).toEqual(new Set(["sans", "serif"]));
  });

  it("offers only monospace families for the mono role", () => {
    const categories = new Set(fontOptionsForRole("mono").map(option => option.category));
    expect(categories).toEqual(new Set(["mono"]));
  });

  it("groups text options as sans serif before serif and skips empty groups", () => {
    const groups = fontGroupsForRole("text");
    expect(groups.map(group => group.category)).toEqual(["sans", "serif"]);
    for (const group of groups) expect(group.options.length).toBeGreaterThan(0);
  });

  it("keeps the shipped defaults selectable so existing clients stay valid", () => {
    const defaults = createDefaultAstroConfig({
      businessName: "Fargo Hot Tubs",
      shortName: "Fargo Tubs",
      foundedYear: 2011,
      tagline: "Relax in Fargo",
      websiteUrl: "https://fargohottubs.com",
      phone: "+17015551234",
      email: "hello@fargohottubs.com",
      streetAddress: "1420 Dakota Ave",
      city: "Fargo",
      state: "ND",
      postalCode: "58103",
      country: "US",
      businessHours: BUSINESS_DAY_VALUES.map(day => ({
        day,
        isOpen: true,
        opensAt: "09:00",
        closesAt: "17:00",
      })),
      facebookUrl: "",
      theme: "aqua",
    }).brand.fonts;

    expect(fontSelectionState(defaults.display, "text")).toBe("approved");
    expect(fontSelectionState(defaults.body, "text")).toBe("approved");
    expect(fontSelectionState(defaults.mono, "mono")).toBe("approved");
  });
});

describe("fontSelectionState", () => {
  it("reports a blank value as empty", () => {
    expect(fontSelectionState("", "text")).toBe("empty");
    expect(fontSelectionState("   ", "text")).toBe("empty");
  });

  it("reports a family outside the approved list as unapproved", () => {
    expect(fontSelectionState("times new roman", "text")).toBe("unapproved");
  });

  it("reports an approved family used in the wrong role as unapproved", () => {
    expect(fontSelectionState("Manrope", "mono")).toBe("unapproved");
    expect(fontSelectionState("JetBrains Mono", "text")).toBe("unapproved");
  });

  it("matches approved families regardless of surrounding whitespace", () => {
    expect(fontSelectionState("  Manrope  ", "text")).toBe("approved");
  });
});

describe("fontStack", () => {
  it("quotes the family and falls back within its own category", () => {
    expect(fontStack("Playfair Display", "text")).toBe(
      '"Playfair Display", ui-serif, Georgia, serif',
    );
    expect(fontStack("Manrope", "text")).toBe('"Manrope", ui-sans-serif, system-ui, sans-serif');
    expect(fontStack("JetBrains Mono", "mono")).toBe(
      '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    );
  });

  it("falls back to the role default for an unapproved family", () => {
    expect(fontStack("times new roman", "text")).toBe(
      '"times new roman", ui-sans-serif, system-ui, sans-serif',
    );
    expect(fontStack("times new roman", "mono")).toBe(
      '"times new roman", ui-monospace, SFMono-Regular, monospace',
    );
  });

  it("returns the bare role fallback when no family is set", () => {
    expect(fontStack("", "text")).toBe("ui-sans-serif, system-ui, sans-serif");
    expect(fontStack("", "mono")).toBe("ui-monospace, SFMono-Regular, monospace");
  });
});

describe("fontPreviewStylesheetHref", () => {
  const href = fontPreviewStylesheetHref();

  it("requests every catalog family from Google Fonts", () => {
    for (const option of FONT_CATALOG) {
      expect(href).toContain(`family=${option.family.replace(/ /g, "+")}`);
    }
  });

  it("requests regular and bold so specimens show real weight contrast", () => {
    expect(href.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    for (const request of requestedWeights(href)) {
      expect(request.weights).toEqual([400, 700]);
    }
  });

  it("swaps rather than blocking paint while preview faces load", () => {
    expect(href).toContain("display=swap");
  });
});

describe("siteFontStylesheetHref", () => {
  it("asks each family only for weights it publishes", () => {
    const href = siteFontStylesheetHref({
      display: "Libre Baskerville",
      body: "Lato",
      mono: "Space Mono",
    });
    expect(requestedWeights(href)).toEqual([
      { family: "Libre Baskerville", weights: [400, 500, 600, 700] },
      { family: "Lato", weights: [400, 700] },
      { family: "Space Mono", weights: [400, 700] },
    ]);
  });

  it("merges a shared display and body family into one request", () => {
    const href = siteFontStylesheetHref({
      display: "Manrope",
      body: "Manrope",
      mono: "JetBrains Mono",
    });
    expect(requestedWeights(href)).toEqual([
      { family: "Manrope", weights: [400, 500, 600, 700, 800] },
      { family: "JetBrains Mono", weights: [400, 500, 700] },
    ]);
  });

  it("skips families outside the catalog, whose published weights are unknown", () => {
    const href = siteFontStylesheetHref({
      display: "Comic Sans MS",
      body: "Inter",
      mono: "JetBrains Mono",
    });
    expect(href).not.toContain("Comic");
    expect(href).toContain("family=Inter:");
  });

  it("returns an empty string when nothing is recognised", () => {
    expect(siteFontStylesheetHref({ display: "", body: "", mono: "" })).toBe("");
  });
});

describe("isGeneratedFontStylesheetHref", () => {
  it("treats a blank URL and our own output as ours to regenerate", () => {
    expect(isGeneratedFontStylesheetHref("")).toBe(true);
    expect(
      isGeneratedFontStylesheetHref(
        siteFontStylesheetHref({ display: "Sora", body: "Inter", mono: "Space Mono" }),
      ),
    ).toBe(true);
  });

  it("treats the legacy Manrope-only default as ours, so old configs catch up", () => {
    expect(
      isGeneratedFontStylesheetHref(
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      ),
    ).toBe(true);
  });

  it("leaves a self-hosted sheet or an unknown family alone", () => {
    expect(isGeneratedFontStylesheetHref("https://cdn.example.com/fonts.css")).toBe(false);
    expect(
      isGeneratedFontStylesheetHref(
        "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400&display=swap",
      ),
    ).toBe(false);
  });
});

describe("syncFontStylesheetHref", () => {
  it("rewrites a generated URL to match the new selection", () => {
    const synced = syncFontStylesheetHref({
      display: "Playfair Display",
      body: "Source Serif 4",
      mono: "JetBrains Mono",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
    });
    expect(synced.googleFontsUrl).toContain("family=Playfair+Display:");
    expect(synced.googleFontsUrl).toContain("family=Source+Serif+4:");
    expect(synced.googleFontsUrl).not.toContain("Manrope");
  });

  it("preserves an operator's own URL", () => {
    const fonts = {
      display: "Playfair Display",
      body: "Source Serif 4",
      mono: "JetBrains Mono",
      googleFontsUrl: "https://cdn.example.com/fonts.css",
    };
    expect(syncFontStylesheetHref(fonts)).toEqual(fonts);
  });
});
