/**
 * Curated display/body combinations. Every family here must exist in
 * `FONT_CATALOG` under the `text` role, so choosing a pairing can never move a
 * config into an unapproved state.
 */
export type FontPairing = {
  id: string;
  name: string;
  mood: string;
  display: string;
  body: string;
};

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "modern",
    name: "Modern",
    mood: "Clean and neutral",
    display: "Manrope",
    body: "Manrope",
  },
  {
    id: "editorial",
    name: "Editorial",
    mood: "Magazine authority",
    display: "Playfair Display",
    body: "Source Serif 4",
  },
  {
    id: "warm-classic",
    name: "Warm Classic",
    mood: "Characterful and inviting",
    display: "Fraunces",
    body: "EB Garamond",
  },
  {
    id: "contemporary",
    name: "Contemporary",
    mood: "Technical and current",
    display: "Sora",
    body: "Inter",
  },
  {
    id: "approachable",
    name: "Approachable",
    mood: "Friendly and open",
    display: "Outfit",
    body: "DM Sans",
  },
  {
    id: "authority",
    name: "Authority",
    mood: "Established and trusted",
    display: "Libre Baskerville",
    body: "Work Sans",
  },
];

function matches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The pairing a selection came from, or undefined once it has been fine-tuned. */
export function activePairingId(fonts: { display: string; body: string }): string | undefined {
  return FONT_PAIRINGS.find(
    pairing => matches(pairing.display, fonts.display) && matches(pairing.body, fonts.body),
  )?.id;
}
