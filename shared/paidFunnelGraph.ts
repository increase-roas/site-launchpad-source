import { z } from "zod";
import {
  PAID_FUNNEL_ELEMENT_TYPES,
  PAID_FUNNEL_SECTION_PRESETS,
  createIdFactory,
  defaultElementStyles,
  defaultVisibility,
  emptySpacing,
  type FunnelColumn,
  type FunnelElement,
  type FunnelPage,
  type FunnelRow,
  type FunnelSection,
  type GlobalFunnelStyles,
  type PaidFunnelElementType,
  type PaidFunnelSectionPreset,
  type ReusableSection,
} from "./paidFunnel/graph";

export const PAID_FUNNEL_GRAPH_VERSION = 1 as const;

export {
  PAID_FUNNEL_ELEMENT_TYPES,
  PAID_FUNNEL_SECTION_PRESETS,
};
export type { PaidFunnelElementType, PaidFunnelSectionPreset };

export type PaidFunnelElement = FunnelElement;
export type PaidFunnelColumn = FunnelColumn;
export type PaidFunnelRow = FunnelRow;
export type PaidFunnelSection = FunnelSection;
export type PaidFunnelPage = FunnelPage;

/** Wire/storage graph: versioned Page → Section → Row → Column → Element (builder node shape). */
export type PaidFunnelGraph = {
  version: typeof PAID_FUNNEL_GRAPH_VERSION;
  pages: FunnelPage[];
  funnelKey?: string;
  name?: string;
  globalStyles?: GlobalFunnelStyles;
  reusableSections?: ReusableSection[];
};

const stableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    "Stable IDs must start with a letter and use letters, numbers, underscores, or hyphens."
  );

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function gridToPercent(units: number | undefined, fallback: number): number {
  if (typeof units !== "number" || !Number.isFinite(units)) return fallback;
  if (units <= 12) return Math.round((units / 12) * 10000) / 100;
  return units;
}

function mapValign(
  value: unknown
): FunnelRow["valign"] {
  if (value === "center") return "center";
  if (value === "end" || value === "bottom") return "bottom";
  return "top";
}

function mapAlignment(value: unknown): FunnelColumn["alignment"] {
  if (value === "center") return "center";
  if (value === "end" || value === "right") return "right";
  return "left";
}

function legacyHiddenToVisibility(hiddenOn: unknown) {
  const visibility = defaultVisibility();
  if (!Array.isArray(hiddenOn)) return visibility;
  for (const item of hiddenOn) {
    if (item === "desktop") visibility.desktop = false;
    if (item === "tablet") visibility.tablet = false;
    if (item === "mobile") visibility.mobile = false;
  }
  return visibility;
}

function migrateElement(raw: unknown, nextId: () => string): FunnelElement {
  if (!isRecord(raw)) {
    throw new Error("Paid funnel element is invalid.");
  }
  const type = raw.type;
  if (
    typeof type !== "string" ||
    !(PAID_FUNNEL_ELEMENT_TYPES as readonly string[]).includes(type)
  ) {
    throw new Error(`Unknown paid funnel element type "${String(type)}".`);
  }
  const id = asString(raw.id) || nextId();
  if (raw.kind === "element") {
    return {
      id,
      kind: "element",
      type: type as PaidFunnelElementType,
      props: isRecord(raw.props) ? raw.props : {},
      styles:
        isRecord(raw.styles) && raw.styles
          ? { ...defaultElementStyles(), ...(raw.styles as object) }
          : defaultElementStyles(),
      visibility: isRecord(raw.visibility)
        ? {
            desktop: raw.visibility.desktop !== false,
            tablet: raw.visibility.tablet !== false,
            mobile: raw.visibility.mobile !== false,
          }
        : defaultVisibility(),
    };
  }
  const legacyStyles = isRecord(raw.styles) ? raw.styles : {};
  return {
    id,
    kind: "element",
    type: type as PaidFunnelElementType,
    props: isRecord(raw.props) ? raw.props : {},
    styles: {
      ...defaultElementStyles(),
      color: asString(legacyStyles.color) || undefined,
      background: asString(legacyStyles.background)
        ? { kind: "color", color: asString(legacyStyles.background) }
        : { kind: "none" },
    },
    visibility: legacyHiddenToVisibility(legacyStyles.hiddenOn),
  };
}

function migrateColumn(raw: unknown, nextId: () => string): FunnelColumn {
  if (!isRecord(raw)) throw new Error("Paid funnel column is invalid.");
  const id = asString(raw.id) || nextId();
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map(element => migrateElement(element, nextId))
    : [];
  if (raw.kind === "column" && isRecord(raw.widths)) {
    return {
      id,
      kind: "column",
      widths: {
        desktop: asNumber(raw.widths.desktop, 100),
        tablet: asNumber(raw.widths.tablet, asNumber(raw.widths.desktop, 100)),
        mobile: asNumber(raw.widths.mobile, 100),
      },
      alignment: mapAlignment(raw.alignment),
      padding: isRecord(raw.padding)
        ? (raw.padding as FunnelColumn["padding"])
        : { desktop: emptySpacing(16) },
      background: isRecord(raw.background)
        ? (raw.background as FunnelColumn["background"])
        : { kind: "none" },
      borderColor: asString(raw.borderColor, "transparent"),
      borderWidth: asNumber(raw.borderWidth, 0),
      borderRadius: asNumber(raw.borderRadius, 0),
      visibility: isRecord(raw.visibility)
        ? {
            desktop: raw.visibility.desktop !== false,
            tablet: raw.visibility.tablet !== false,
            mobile: raw.visibility.mobile !== false,
          }
        : defaultVisibility(),
      elements,
    };
  }
  const width = isRecord(raw.width) ? raw.width : {};
  const desktop = gridToPercent(asNumber(width.desktop, 12), 100);
  return {
    id,
    kind: "column",
    widths: {
      desktop,
      tablet: gridToPercent(
        typeof width.tablet === "number" ? width.tablet : undefined,
        desktop
      ),
      mobile: gridToPercent(
        typeof width.mobile === "number" ? width.mobile : undefined,
        100
      ),
    },
    alignment: mapAlignment(isRecord(raw.styles) ? raw.styles.alignment : undefined),
    padding: { desktop: emptySpacing(16) },
    background: { kind: "none" },
    borderColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    visibility: legacyHiddenToVisibility(
      isRecord(raw.styles) ? raw.styles.hiddenOn : undefined
    ),
    elements,
  };
}

function migrateRow(raw: unknown, nextId: () => string): FunnelRow {
  if (!isRecord(raw)) throw new Error("Paid funnel row is invalid.");
  const id = asString(raw.id) || nextId();
  const columns = Array.isArray(raw.columns)
    ? raw.columns.map(column => migrateColumn(column, nextId))
    : [];
  if (columns.length < 1) {
    throw new Error("Paid funnel row requires at least one column.");
  }
  if (raw.kind === "row") {
    return {
      id,
      kind: "row",
      gap: asNumber(raw.gap, 16),
      valign: mapValign(raw.valign),
      wrap: raw.wrap !== false,
      background: isRecord(raw.background)
        ? (raw.background as FunnelRow["background"])
        : { kind: "none" },
      padding: isRecord(raw.padding)
        ? (raw.padding as FunnelRow["padding"])
        : { desktop: emptySpacing(0) },
      columns,
    };
  }
  const gapRaw = raw.gap;
  const gap =
    typeof gapRaw === "number"
      ? gapRaw
      : typeof gapRaw === "string"
        ? Number.parseFloat(gapRaw) || 16
        : 16;
  return {
    id,
    kind: "row",
    gap,
    valign: mapValign(raw.valign),
    wrap: raw.wrap !== false,
    background: { kind: "none" },
    padding: { desktop: emptySpacing(0) },
    columns,
  };
}

function migrateSection(raw: unknown, nextId: () => string): FunnelSection {
  if (!isRecord(raw)) throw new Error("Paid funnel section is invalid.");
  const id = asString(raw.id) || nextId();
  const presetRaw = asString(raw.preset, "blank");
  const preset = (
    (PAID_FUNNEL_SECTION_PRESETS as readonly string[]).includes(presetRaw)
      ? presetRaw
      : "blank"
  ) as PaidFunnelSectionPreset;
  const rows = Array.isArray(raw.rows)
    ? raw.rows.map(row => migrateRow(row, nextId))
    : [];
  if (raw.kind === "section") {
    return {
      id,
      kind: "section",
      preset,
      layout: raw.layout === "full" ? "full" : "boxed",
      maxWidth: asNumber(raw.maxWidth, 1120),
      minHeight: asNumber(raw.minHeight, 0),
      alignment: mapAlignment(raw.alignment),
      padding: isRecord(raw.padding)
        ? (raw.padding as FunnelSection["padding"])
        : { desktop: { top: 56, right: 24, bottom: 56, left: 24 } },
      margin: isRecord(raw.margin)
        ? (raw.margin as FunnelSection["margin"])
        : { desktop: emptySpacing(0) },
      background: isRecord(raw.background)
        ? (raw.background as FunnelSection["background"])
        : { kind: "none" },
      overlay: (raw.overlay as FunnelSection["overlay"]) ?? null,
      borderColor: asString(raw.borderColor, "transparent"),
      borderWidth: asNumber(raw.borderWidth, 0),
      borderRadius: asNumber(raw.borderRadius, 0),
      shadow: asString(raw.shadow, "none"),
      sticky: Boolean(raw.sticky),
      anchor: asString(raw.anchor),
      className: asString(raw.className),
      visibility: isRecord(raw.visibility)
        ? {
            desktop: raw.visibility.desktop !== false,
            tablet: raw.visibility.tablet !== false,
            mobile: raw.visibility.mobile !== false,
          }
        : defaultVisibility(),
      rows,
    };
  }
  return {
    id,
    kind: "section",
    preset,
    layout: preset === "full-width" ? "full" : "boxed",
    maxWidth: 1120,
    minHeight: 0,
    alignment: "left",
    padding: { desktop: { top: 56, right: 24, bottom: 56, left: 24 } },
    margin: { desktop: emptySpacing(0) },
    background: { kind: "none" },
    overlay: null,
    borderColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    shadow: "none",
    sticky: false,
    anchor: "",
    className: "",
    visibility: legacyHiddenToVisibility(
      isRecord(raw.styles) ? raw.styles.hiddenOn : undefined
    ),
    rows,
  };
}

function migratePage(raw: unknown, nextId: () => string): FunnelPage {
  if (!isRecord(raw)) throw new Error("Paid funnel page is invalid.");
  const id = asString(raw.id) || nextId();
  const stepKey = asString(raw.stepKey);
  if (!stepKey) throw new Error("Paid funnel page is missing stepKey.");
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map(section => migrateSection(section, nextId))
    : [];
  return {
    id,
    kind: "page",
    stepKey,
    sections,
  };
}

function assertUniqueIds(graph: PaidFunnelGraph): void {
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) {
      throw new Error(`Duplicate stable id "${id}".`);
    }
    seen.add(id);
  };
  for (const page of graph.pages) {
    walk(page.id);
    for (const section of page.sections) {
      walk(section.id);
      for (const row of section.rows) {
        walk(row.id);
        for (const column of row.columns) {
          walk(column.id);
          for (const element of column.elements) {
            walk(element.id);
          }
        }
      }
    }
  }
}

function normalizePages(pages: unknown): unknown[] {
  if (Array.isArray(pages)) return pages;
  if (isRecord(pages)) {
    return Object.values(pages).filter(page => isRecord(page));
  }
  return [];
}

export function migratePaidFunnelGraph(input: unknown): PaidFunnelGraph {
  if (!input || typeof input !== "object") {
    throw new Error("Paid funnel graph is missing.");
  }
  const record = input as {
    version?: unknown;
    schemaVersion?: unknown;
    pages?: unknown;
    funnelKey?: unknown;
    name?: unknown;
    globalStyles?: unknown;
    reusableSections?: unknown;
    kind?: unknown;
  };
  if (record.kind && record.kind !== "paid-funnel") {
    throw new Error("Only paid-funnel graphs can be persisted.");
  }
  const version =
    typeof record.version === "number"
      ? record.version
      : typeof record.schemaVersion === "number"
        ? record.schemaVersion
        : 0;
  if (version !== 0 && version !== PAID_FUNNEL_GRAPH_VERSION) {
    throw new Error(`Unsupported paid funnel graph version ${String(version)}.`);
  }
  const rawPages = normalizePages(record.pages);
  if (rawPages.length < 1) {
    throw new Error("Paid funnel graph requires at least one page.");
  }
  const nextId = createIdFactory("pf");
  const graph: PaidFunnelGraph = {
    version: PAID_FUNNEL_GRAPH_VERSION,
    pages: rawPages.map(page => migratePage(page, nextId)),
  };
  if (typeof record.funnelKey === "string" && record.funnelKey.trim()) {
    graph.funnelKey = record.funnelKey;
  }
  if (typeof record.name === "string" && record.name.trim()) {
    graph.name = record.name;
  }
  if (isRecord(record.globalStyles)) {
    graph.globalStyles = record.globalStyles as GlobalFunnelStyles;
  }
  if (Array.isArray(record.reusableSections)) {
    graph.reusableSections = record.reusableSections as ReusableSection[];
  }
  assertUniqueIds(graph);
  for (const page of graph.pages) {
    stableIdSchema.parse(page.id);
  }
  return graph;
}

export const paidFunnelGraphSchema: z.ZodType<PaidFunnelGraph> = z
  .unknown()
  .transform((value, context) => {
    try {
      return migratePaidFunnelGraph(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid paid funnel graph.",
      });
      return z.NEVER;
    }
  });

export const paidFunnelSectionSchema: z.ZodType<FunnelSection> = z
  .unknown()
  .transform((value, context) => {
    try {
      return migrateSection(value, createIdFactory("sec"));
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid section.",
      });
      return z.NEVER;
    }
  });

export function collectGraphElementTypes(
  graph: PaidFunnelGraph
): Set<PaidFunnelElementType> {
  const types = new Set<PaidFunnelElementType>();
  for (const page of graph.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const column of row.columns) {
          for (const element of column.elements) {
            types.add(element.type);
          }
        }
      }
    }
  }
  return types;
}

export function pageGraphFromBuilderPage(page: FunnelPage): PaidFunnelGraph {
  return migratePaidFunnelGraph({
    version: PAID_FUNNEL_GRAPH_VERSION,
    pages: [page],
  });
}
