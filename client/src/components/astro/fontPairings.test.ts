import { describe, expect, it } from "vitest";
import { fontSelectionState, siteFontStylesheetHref } from "./fontCatalog";
import { activePairingId, FONT_PAIRINGS } from "./fontPairings";

describe("font pairings", () => {
  it("uses ids that are unique and stable enough to key on", () => {
    const ids = FONT_PAIRINGS.map(pairing => pairing.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only names families approved for the text role", () => {
    for (const pairing of FONT_PAIRINGS) {
      expect(fontSelectionState(pairing.display, "text")).toBe("approved");
      expect(fontSelectionState(pairing.body, "text")).toBe("approved");
    }
  });

  it("produces a loadable stylesheet for every pairing", () => {
    for (const pairing of FONT_PAIRINGS) {
      const href = siteFontStylesheetHref({ ...pairing, mono: "JetBrains Mono" });
      expect(href).toContain(`family=${pairing.display.replace(/ /g, "+")}:`);
      expect(href).toContain(`family=${pairing.body.replace(/ /g, "+")}:`);
    }
  });
});

describe("activePairingId", () => {
  it("recognises each pairing it produced", () => {
    for (const pairing of FONT_PAIRINGS) {
      expect(activePairingId(pairing)).toBe(pairing.id);
    }
  });

  it("ignores casing and stray whitespace", () => {
    expect(activePairingId({ display: "  manrope ", body: "MANROPE" })).toBe("modern");
  });

  it("reports no pairing once the selection has been fine-tuned", () => {
    expect(activePairingId({ display: "Playfair Display", body: "Manrope" })).toBeUndefined();
    expect(activePairingId({ display: "", body: "" })).toBeUndefined();
  });
});
