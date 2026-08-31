import { z } from "zod";
import {
  astroClientConfigInputSchema,
  type AstroClientConfigInput,
  type WranglerSecretName,
} from "./astroConfig";
import {
  websiteIntegrationEnablement,
  websiteRequiredProfileKeys,
} from "./clientIntegrationProfile";

/**
 * Per-section readiness for the client Configuration tab.
 *
 * Required-ness is derived from `astroClientConfigInputSchema` rather than a
 * hand-maintained list, so the counts shown in the UI cannot drift from the
 * validation that already gates saving. Two rules do all the work:
 *
 * 1. A string leaf is required exactly when it rejects the empty string.
 *    `address.city` is `.min(2)` and rejects it; `address.street2` is `.max(240)`
 *    and accepts it; `address.latitude` short-circuits on empty.
 * 2. Missing versus invalid comes from parsing the real config and bucketing
 *    each issue by whether the value at its path is blank. This handles the
 *    conditionally-required groups (categories, financing, homepage sections)
 *    for free, because their `superRefine` is gated on `enabled`.
 */

export const CONFIG_TAB_IDS = ["basic", "branding", "media", "content", "technical"] as const;
export type ConfigTabId = (typeof CONFIG_TAB_IDS)[number];

export const CONFIG_SECTION_IDS = [
  "identity",
  "contact",
  "address",
  "hours",
  "socialLinks",
  "theme",
  "fonts",
  "media",
  "navigation",
  "categories",
  "financing",
  "homepage",
  "integrations",
  "clientIntegrations",
] as const;
export type ConfigSectionId = (typeof CONFIG_SECTION_IDS)[number];

export type FieldState = "complete" | "incomplete" | "invalid" | "optional";

export const CONFIG_SECTION_LABELS: Record<ConfigSectionId, string> = {
  identity: "Identity",
  contact: "Contact",
  address: "Address",
  hours: "Hours",
  socialLinks: "Social links",
  theme: "Theme",
  fonts: "Fonts",
  media: "Media",
  navigation: "Navigation",
  categories: "Categories",
  financing: "Financing",
  homepage: "Homepage sections",
  integrations: "Integrations",
  clientIntegrations: "Client integrations",
};

export const CONFIG_TAB_LABELS: Record<ConfigTabId, string> = {
  basic: "Basic info",
  branding: "Branding",
  media: "Media",
  content: "Content",
  technical: "Technical",
};

export const CONFIG_TAB_SECTIONS: Record<ConfigTabId, ConfigSectionId[]> = {
  basic: ["identity", "contact", "address", "hours", "socialLinks"],
  branding: ["theme", "fonts"],
  media: ["media"],
  content: ["navigation", "categories", "financing", "homepage"],
  technical: ["integrations", "clientIntegrations"],
};

/** Asset slots `toCanonicalAstroClientConfig` requires for a client deploy. */
export const REQUIRED_ASSET_SLOTS = ["navLogo", "footerLogo", "favicon", "ogImage"] as const;

/** Fields that are real but rarely touched, demoted behind an Advanced drawer. */
export const ADVANCED_FIELD_PATHS = new Set([
  "address.latitude",
  "address.longitude",
  "address.googlePlaceId",
  "contact.phoneDisplayOverride",
  "brand.fonts.mono",
  "brand.fonts.googleFontsUrl",
]);

export type SectionReadiness = {
  id: ConfigSectionId;
  label: string;
  tab: ConfigTabId;
  requiredTotal: number;
  requiredFilled: number;
  incomplete: number;
  invalid: number;
  state: "complete" | "incomplete" | "invalid";
};

export type TabReadiness = {
  id: ConfigTabId;
  label: string;
  requiredTotal: number;
  requiredFilled: number;
  incomplete: number;
  invalid: number;
  state: "complete" | "incomplete" | "invalid";
};

export type ConfigReadiness = {
  sections: Record<ConfigSectionId, SectionReadiness>;
  tabs: Record<ConfigTabId, TabReadiness>;
  /** Path such as `address.postalCode` mapped to its message and blank-ness. */
  fields: Map<string, { message: string; blank: boolean }>;
  /** Issues whose path maps to no known section, so they cannot be shown inline. */
  unmapped: Array<{ path: string; message: string }>;
  requiredTotal: number;
  requiredFilled: number;
  ready: boolean;
};

function objectShape(schema: unknown): Record<string, z.ZodType> | null {
  if (!schema || typeof schema !== "object") return null;
  if (!(schema instanceof z.ZodObject)) return null;
  return schema.shape as Record<string, z.ZodType>;
}

/**
 * A string leaf is optional when it accepts `""`. Number, enum, and boolean
 * leaves also reject `""` but are always present in the input type, so they
 * count as required and always satisfied.
 */
function isRequiredLeaf(schema: z.ZodType): boolean {
  return !schema.safeParse("").success;
}

function collectRequiredPaths(
  schema: z.ZodType,
  prefix: string[],
  out: string[],
): void {
  const shape = objectShape(schema);
  if (shape) {
    for (const [key, child] of Object.entries(shape)) {
      collectRequiredPaths(child, [...prefix, key], out);
    }
    return;
  }
  if (isRequiredLeaf(schema)) out.push(prefix.join("."));
}

/**
 * Statically required leaf paths inside the plain nested objects. Arrays and
 * records (hours, categories, navigation, homepage sections, integrations) are
 * conditionally required, so their counts come from live parse issues instead.
 */
function computeStaticRequiredPaths(): string[] {
  const out: string[] = [];
  const shape = objectShape(astroClientConfigInputSchema);
  if (!shape) return out;
  for (const root of ["identity", "contact", "address", "socialLinks", "brand"] as const) {
    const child = shape[root];
    if (child) collectRequiredPaths(child, [root], out);
  }
  return out;
}

const STATIC_REQUIRED_PATHS = computeStaticRequiredPaths();

/** Exposed for tests that assert the probe classifies the schema correctly. */
export function staticRequiredPaths(): string[] {
  return [...STATIC_REQUIRED_PATHS];
}

export function sectionForPath(path: string): ConfigSectionId | null {
  if (path.startsWith("identity")) return "identity";
  if (path.startsWith("contact")) return "contact";
  if (path.startsWith("address")) return "address";
  if (path.startsWith("hours")) return "hours";
  if (path.startsWith("socialLinks")) return "socialLinks";
  if (path.startsWith("brand.fonts")) return "fonts";
  if (path.startsWith("brand")) return "theme";
  if (path.startsWith("navigationItems")) return "navigation";
  if (path.startsWith("categories")) return "categories";
  if (path.startsWith("financing")) return "financing";
  if (path.startsWith("homepageSections")) return "homepage";
  if (path.startsWith("integrations")) return "integrations";
  return null;
}

function valueAtPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function emptySection(id: ConfigSectionId, tab: ConfigTabId): SectionReadiness {
  return {
    id,
    label: CONFIG_SECTION_LABELS[id],
    tab,
    requiredTotal: 0,
    requiredFilled: 0,
    incomplete: 0,
    invalid: 0,
    state: "complete",
  };
}

function resolveState(incomplete: number, invalid: number): SectionReadiness["state"] {
  if (invalid > 0) return "invalid";
  if (incomplete > 0) return "incomplete";
  return "complete";
}

/**
 * Credentials live in the client integration profile, not in the config
 * document, so the schema probe above cannot see them and the Technical tab
 * would otherwise score itself `0 of 0` and paint green. Callers that hold the
 * vault status pass it here; callers that only care about page content (the
 * pages manager) omit it and the section stays out of the count.
 */
function countClientCredentials(
  section: SectionReadiness,
  config: AstroClientConfigInput,
  secretStatus: Partial<Record<WranglerSecretName, boolean>>,
): void {
  const enabled = websiteIntegrationEnablement(config.integrations);
  for (const key of websiteRequiredProfileKeys(enabled)) {
    section.requiredTotal += 1;
    if (secretStatus[key as WranglerSecretName]) section.requiredFilled += 1;
    else section.incomplete += 1;
  }
}

export function summarizeAstroConfigReadiness(
  config: AstroClientConfigInput,
  assets: Array<{ slot: string }> = [],
  secretStatus?: Partial<Record<WranglerSecretName, boolean>>,
): ConfigReadiness {
  const tabForSection = new Map<ConfigSectionId, ConfigTabId>();
  for (const tab of CONFIG_TAB_IDS) {
    for (const section of CONFIG_TAB_SECTIONS[tab]) tabForSection.set(section, tab);
  }

  const sections = Object.fromEntries(
    CONFIG_SECTION_IDS.map(id => [id, emptySection(id, tabForSection.get(id) ?? "basic")]),
  ) as Record<ConfigSectionId, SectionReadiness>;

  const fields = new Map<string, { message: string; blank: boolean }>();
  const unmapped: Array<{ path: string; message: string }> = [];

  // Union of statically required leaves and leaves currently reporting an issue.
  // A set, not a sum: a blank required field appears in both and would double count.
  const requiredPaths = new Map<string, ConfigSectionId>();
  for (const path of STATIC_REQUIRED_PATHS) {
    const section = sectionForPath(path);
    if (section) requiredPaths.set(path, section);
  }

  const parsed = astroClientConfigInputSchema.safeParse(config);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String).join(".");
      const section = sectionForPath(path);
      if (!section) {
        unmapped.push({ path, message: issue.message });
        continue;
      }
      const blank = isBlankValue(valueAtPath(config, path));
      // Keep the first message per path; later issues on the same field are noise.
      if (!fields.has(path)) fields.set(path, { message: issue.message, blank });
      requiredPaths.set(path, section);
    }
  }

  for (const [path, section] of requiredPaths) {
    sections[section].requiredTotal += 1;
    const issue = fields.get(path);
    if (!issue) {
      sections[section].requiredFilled += 1;
      continue;
    }
    if (issue.blank) sections[section].incomplete += 1;
    else sections[section].invalid += 1;
  }

  // Media has no schema representation; its assets live outside the config.
  const presentSlots = new Set(assets.map(asset => asset.slot));
  for (const slot of REQUIRED_ASSET_SLOTS) {
    sections.media.requiredTotal += 1;
    if (presentSlots.has(slot)) sections.media.requiredFilled += 1;
    else sections.media.incomplete += 1;
  }

  if (secretStatus) {
    countClientCredentials(sections.clientIntegrations, config, secretStatus);
  }

  for (const id of CONFIG_SECTION_IDS) {
    sections[id].state = resolveState(sections[id].incomplete, sections[id].invalid);
  }

  const tabs = Object.fromEntries(
    CONFIG_TAB_IDS.map(tab => {
      const members = CONFIG_TAB_SECTIONS[tab].map(id => sections[id]);
      const requiredTotal = members.reduce((sum, section) => sum + section.requiredTotal, 0);
      const requiredFilled = members.reduce((sum, section) => sum + section.requiredFilled, 0);
      const incomplete = members.reduce((sum, section) => sum + section.incomplete, 0);
      const invalid = members.reduce((sum, section) => sum + section.invalid, 0);
      return [
        tab,
        {
          id: tab,
          label: CONFIG_TAB_LABELS[tab],
          requiredTotal,
          requiredFilled,
          incomplete,
          invalid,
          state: resolveState(incomplete, invalid),
        } satisfies TabReadiness,
      ];
    }),
  ) as Record<ConfigTabId, TabReadiness>;

  const requiredTotal = CONFIG_TAB_IDS.reduce((sum, tab) => sum + tabs[tab].requiredTotal, 0);
  const requiredFilled = CONFIG_TAB_IDS.reduce((sum, tab) => sum + tabs[tab].requiredFilled, 0);

  return {
    sections,
    tabs,
    fields,
    unmapped,
    requiredTotal,
    requiredFilled,
    ready: requiredFilled === requiredTotal && unmapped.length === 0,
  };
}

/**
 * The subset `ConfigSection` needs to render its header. Sections whose
 * completeness is not schema-derived, such as asset groups, build one directly.
 */
export type SectionMeter = Pick<
  SectionReadiness,
  "state" | "requiredTotal" | "requiredFilled" | "incomplete" | "invalid"
> & { id?: ConfigSectionId };

export function meterFromCounts(filled: number, total: number): SectionMeter {
  const incomplete = Math.max(0, total - filled);
  return {
    requiredTotal: total,
    requiredFilled: filled,
    incomplete,
    invalid: 0,
    state: resolveState(incomplete, 0),
  };
}

/** State for a single field, for cell styling. */
export function fieldStateFor(
  readiness: ConfigReadiness,
  path: string,
  options: { optional?: boolean } = {},
): FieldState {
  const issue = readiness.fields.get(path);
  if (issue) return issue.blank ? "incomplete" : "invalid";
  if (options.optional) return "optional";
  return "complete";
}

export function fieldMessageFor(readiness: ConfigReadiness, path: string): string | undefined {
  return readiness.fields.get(path)?.message;
}
