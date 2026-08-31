/** Approved font families shared by the picker and configuration verification. */
export type FontCategory = "sans" | "serif" | "mono";
export type FontRole = "text" | "mono";
export type FontUsage = "display" | "body" | "mono";

/**
 * `weights` lists the static weights Google actually publishes for the family.
 * The css2 endpoint rejects the whole stylesheet with a 400 if any requested
 * weight is missing, so every generated URL is intersected against this list
 * rather than assuming a uniform 100–900 range. Lato skips 500 and 600, and
 * Space Mono ships only 400 and 700.
 */
export type FontOption = { family: string; category: FontCategory; weights: number[] };

export const FONT_CATALOG: FontOption[] = [
  { family: "Manrope", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Inter", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Inter Tight", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "DM Sans", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: "Plus Jakarta Sans", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Figtree", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Outfit", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Sora", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: "Work Sans", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Poppins", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Montserrat", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Lato", category: "sans", weights: [100, 300, 400, 700, 900] },
  { family: "Fraunces", category: "serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Merriweather", category: "serif", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Source Serif 4", category: "serif", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700, 800] },
  { family: "Libre Baskerville", category: "serif", weights: [400, 500, 600, 700] },
  { family: "JetBrains Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: "IBM Plex Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Roboto Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Source Code Pro", category: "mono", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Space Mono", category: "mono", weights: [400, 700] },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: "Sans serif",
  serif: "Serif",
  mono: "Monospace",
};

const ROLE_CATEGORIES: Record<FontRole, FontCategory[]> = {
  text: ["sans", "serif"],
  mono: ["mono"],
};

const CATEGORY_FALLBACK: Record<FontCategory, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
};

const ROLE_FALLBACK: Record<FontRole, string> = {
  text: CATEGORY_FALLBACK.sans,
  mono: CATEGORY_FALLBACK.mono,
};

/** Weights the built site asks for, before intersecting with what a family publishes. */
const USAGE_WEIGHTS: Record<FontUsage, number[]> = {
  display: [400, 500, 600, 700, 800],
  body: [400, 500, 600, 700],
  mono: [400, 500, 700],
};

/** Enough contrast for the picker specimens without pulling every weight of 24 families. */
const PREVIEW_WEIGHTS = [400, 700];

const GOOGLE_FONTS_CSS2 = "https://fonts.googleapis.com/css2";

export function fontOptionsForRole(role: FontRole): FontOption[] {
  const allowed = new Set<FontCategory>(ROLE_CATEGORIES[role]);
  return FONT_CATALOG.filter(option => allowed.has(option.category));
}

export function fontGroupsForRole(
  role: FontRole,
): Array<{ category: FontCategory; label: string; options: FontOption[] }> {
  return ROLE_CATEGORIES[role]
    .map(category => ({
      category,
      label: FONT_CATEGORY_LABELS[category],
      options: FONT_CATALOG.filter(option => option.category === category),
    }))
    .filter(group => group.options.length > 0);
}

function findOption(family: string, role: FontRole): FontOption | undefined {
  const normalized = family.trim().toLowerCase();
  if (!normalized) return undefined;
  return fontOptionsForRole(role).find(option => option.family.toLowerCase() === normalized);
}

function findCatalogEntry(family: string): FontOption | undefined {
  const normalized = family.trim().toLowerCase();
  if (!normalized) return undefined;
  return FONT_CATALOG.find(option => option.family.toLowerCase() === normalized);
}

export function fontSelectionState(
  family: string,
  role: FontRole,
): "empty" | "approved" | "unapproved" {
  if (!family.trim()) return "empty";
  return findOption(family, role) ? "approved" : "unapproved";
}

export function fontStack(family: string, role: FontRole): string {
  const trimmed = family.trim();
  if (!trimmed) return ROLE_FALLBACK[role];
  const approved = findOption(trimmed, role);
  const fallback = approved ? CATEGORY_FALLBACK[approved.category] : ROLE_FALLBACK[role];
  return `"${trimmed}", ${fallback}`;
}

/**
 * Builds a css2 URL from families already resolved to a supported weight list.
 * Families are merged so a display/body pair sharing one face asks for the union
 * of their weights instead of repeating the `family` parameter.
 */
function googleFontsHref(requests: Array<{ family: string; weights: number[] }>): string {
  const merged = new Map<string, Set<number>>();
  for (const request of requests) {
    if (request.weights.length === 0) continue;
    const existing = merged.get(request.family) ?? new Set<number>();
    for (const weight of request.weights) existing.add(weight);
    merged.set(request.family, existing);
  }
  if (merged.size === 0) return "";

  const families = [...merged].map(([family, weights]) => {
    const ascending = [...weights].sort((a, b) => a - b).join(";");
    return `family=${family.replace(/ /g, "+")}:wght@${ascending}`;
  });
  return `${GOOGLE_FONTS_CSS2}?${families.join("&")}&display=swap`;
}

function supportedWeights(family: string, wanted: number[]): number[] {
  const entry = findCatalogEntry(family);
  if (!entry) return [];
  const published = new Set(entry.weights);
  return wanted.filter(weight => published.has(weight));
}

/** Preview faces for the picker specimens, loaded on demand by the launchpad UI. */
export function fontPreviewStylesheetHref(): string {
  return googleFontsHref(
    FONT_CATALOG.map(option => ({
      family: option.family,
      weights: supportedWeights(option.family, PREVIEW_WEIGHTS),
    })),
  );
}

/**
 * The stylesheet the generated site loads. Families outside the catalog are
 * skipped because their published weights are unknown and a bad weight would
 * fail the entire sheet.
 */
export function siteFontStylesheetHref(fonts: {
  display: string;
  body: string;
  mono: string;
}): string {
  return googleFontsHref([
    { family: fonts.display.trim(), weights: supportedWeights(fonts.display, USAGE_WEIGHTS.display) },
    { family: fonts.body.trim(), weights: supportedWeights(fonts.body, USAGE_WEIGHTS.body) },
    { family: fonts.mono.trim(), weights: supportedWeights(fonts.mono, USAGE_WEIGHTS.mono) },
  ]);
}

/**
 * Whether the stored Google Fonts URL is ours to regenerate when the selection
 * changes. A blank URL, or a css2 URL naming only approved families, is treated
 * as generated; anything else (a self-hosted sheet, or a family we do not know)
 * is an operator override and is left alone.
 */
export type FontSelection = {
  display: string;
  body: string;
  mono: string;
  googleFontsUrl: string;
};

/**
 * Regenerates the stylesheet URL to match the selected families, leaving an
 * operator's own URL untouched. Call this with the already-updated selection:
 * the URL it inspects is still the one stored before the change.
 */
export function syncFontStylesheetHref<T extends FontSelection>(fonts: T): T {
  if (!isGeneratedFontStylesheetHref(fonts.googleFontsUrl)) return fonts;
  return { ...fonts, googleFontsUrl: siteFontStylesheetHref(fonts) };
}

export function isGeneratedFontStylesheetHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return true;
  if (!trimmed.startsWith(`${GOOGLE_FONTS_CSS2}?`)) return false;

  let families: string[];
  try {
    families = new URL(trimmed).searchParams.getAll("family");
  } catch {
    return false;
  }
  if (families.length === 0) return false;
  return families.every(segment => Boolean(findCatalogEntry(segment.split(":")[0] ?? "")));
}
