import { z } from "zod";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "../simpleFormContract";

export const PAID_FUNNEL_GRAPH_SCHEMA_VERSION = 1 as const;
export const PAID_FUNNEL_KIND = "paid-funnel" as const;

export const PAID_FUNNEL_STEP_TYPES = [
  "landing",
  "survey",
  "form",
  "thankYou",
  "booking",
  "upsell",
] as const;
export type PaidFunnelStepType = (typeof PAID_FUNNEL_STEP_TYPES)[number];

export const PAID_FUNNEL_ELEMENT_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "icon",
  "video",
  "spacer",
  "divider",
  "list",
  "form",
  "multipleChoice",
  "shortAnswer",
  "phoneCta",
  "countdown",
  "testimonial",
  "faq",
  "inventory",
  "map",
  "html",
] as const;
export type PaidFunnelElementType = (typeof PAID_FUNNEL_ELEMENT_TYPES)[number];

export const PAID_FUNNEL_SECTION_PRESETS = [
  "blank",
  "full-width",
  "boxed",
  "hero",
  "two-column",
  "three-column",
  "form",
  "testimonial",
  "faq",
  "cta",
  "pricing",
  "footer",
] as const;
export type PaidFunnelSectionPreset = (typeof PAID_FUNNEL_SECTION_PRESETS)[number];

export const PAID_FUNNEL_BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type PaidFunnelBreakpoint = (typeof PAID_FUNNEL_BREAKPOINTS)[number];

export const PAID_FUNNEL_NODE_KINDS = ["page", "section", "row", "column", "element"] as const;
export type PaidFunnelNodeKind = (typeof PAID_FUNNEL_NODE_KINDS)[number];

export const PAID_FUNNEL_STEP_STATE_VALUES = ["draft", "preview", "published"] as const;
export type PaidFunnelStepState = (typeof PAID_FUNNEL_STEP_STATE_VALUES)[number];

export type BoxSpacing = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ResponsiveValue<T> = {
  desktop?: T;
  tablet?: T;
  mobile?: T;
};

export type DeviceVisibility = {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
};

export type Background =
  | { kind: "none" }
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | {
      kind: "image";
      url: string;
      assetId?: string;
      filename?: string;
      size: "cover" | "contain";
      position: string;
    }
  | { kind: "video"; url: string; assetId?: string; filename?: string };

export type Overlay = { color: string; opacity: number };

export type ButtonAction =
  | { type: "nextStep" }
  | { type: "step"; stepKey: string }
  | { type: "url"; href: string; openInNewTab: boolean }
  | { type: "phone"; tel: string }
  | { type: "formSubmit"; formId: string }
  | { type: "booking"; stepKey?: string }
  | {
      type: "conditional";
      rules: Array<{
        field: string;
        operator: "equals" | "notEquals" | "contains";
        value: string;
        stepKey: string;
      }>;
      fallbackStepKey?: string;
    };

export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "center" | "bottom";

export type ElementStyles = {
  fontFamily?: string;
  fontSize?: ResponsiveValue<number>;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  textAlign?: ResponsiveValue<TextAlign>;
  padding?: ResponsiveValue<BoxSpacing>;
  margin?: ResponsiveValue<BoxSpacing>;
  background?: Background;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shadow?: string;
};

export type FunnelElement = {
  id: string;
  kind: "element";
  type: PaidFunnelElementType;
  props: Record<string, unknown>;
  styles: ElementStyles;
  visibility: DeviceVisibility;
};

export type FunnelColumn = {
  id: string;
  kind: "column";
  widths: Record<PaidFunnelBreakpoint, number>;
  alignment: TextAlign;
  padding: ResponsiveValue<BoxSpacing>;
  background: Background;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  visibility: DeviceVisibility;
  elements: FunnelElement[];
};

export type FunnelRow = {
  id: string;
  kind: "row";
  gap: number;
  valign: VerticalAlign;
  wrap: boolean;
  background: Background;
  padding: ResponsiveValue<BoxSpacing>;
  columns: FunnelColumn[];
};

export type FunnelSection = {
  id: string;
  kind: "section";
  preset: PaidFunnelSectionPreset;
  layout: "full" | "boxed";
  maxWidth: number;
  minHeight: number;
  alignment: TextAlign;
  padding: ResponsiveValue<BoxSpacing>;
  margin: ResponsiveValue<BoxSpacing>;
  background: Background;
  overlay: Overlay | null;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: string;
  sticky: boolean;
  anchor: string;
  className: string;
  visibility: DeviceVisibility;
  rows: FunnelRow[];
};

export type FunnelPage = {
  id: string;
  kind: "page";
  stepKey: string;
  sections: FunnelSection[];
};

export type FunnelStepSeo = {
  title: string;
  description: string;
  shareImage?: string;
};

export type FunnelStepNext =
  | { type: "step"; stepKey: string }
  | { type: "redirect"; url: string }
  | { type: "none" };

export type FunnelStepTracking = {
  browserEvent: string;
  serverEvent: string;
  answerField?: string;
};

export type PaidFunnelStep = {
  key: string;
  type: PaidFunnelStepType;
  slug: string;
  title: string;
  seo: FunnelStepSeo;
  nextStep: FunnelStepNext;
  tracking?: FunnelStepTracking;
  previewState: PaidFunnelStepState;
  publishState: PaidFunnelStepState;
};

export type GlobalFunnelStyles = {
  fonts: { heading: string; body: string };
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    primaryText: string;
    border: string;
  };
  button: {
    background: string;
    color: string;
    radius: number;
    paddingX: number;
    paddingY: number;
    fontWeight: number;
  };
  containers: { boxedMaxWidth: number; fullMaxWidth: number };
  mobile: { sectionPadding: BoxSpacing; rowGap: number };
};

export type ReusableSection = {
  id: string;
  name: string;
  section: FunnelSection;
  createdAt: string;
};

export type PaidFunnelGraph = {
  schemaVersion: typeof PAID_FUNNEL_GRAPH_SCHEMA_VERSION;
  kind: typeof PAID_FUNNEL_KIND;
  funnelKey: string;
  name: string;
  version: number;
  steps: PaidFunnelStep[];
  pages: Record<string, FunnelPage>;
  globalStyles: GlobalFunnelStyles;
  reusableSections: ReusableSection[];
};

export type GraphNode = FunnelPage | FunnelSection | FunnelRow | FunnelColumn | FunnelElement;

export function emptySpacing(value = 0): BoxSpacing {
  return { top: value, right: value, bottom: value, left: value };
}

export function defaultVisibility(): DeviceVisibility {
  return { desktop: true, tablet: true, mobile: true };
}

export function defaultGlobalStyles(): GlobalFunnelStyles {
  return {
    fonts: { heading: "Inter", body: "Inter" },
    colors: {
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#172033",
      muted: "#64748b",
      primary: "#1463f3",
      primaryText: "#ffffff",
      border: "#d8e0ec",
    },
    button: {
      background: "#1463f3",
      color: "#ffffff",
      radius: 8,
      paddingX: 22,
      paddingY: 14,
      fontWeight: 800,
    },
    containers: { boxedMaxWidth: 1120, fullMaxWidth: 1440 },
    mobile: { sectionPadding: emptySpacing(20), rowGap: 12 },
  };
}

export function defaultElementStyles(): ElementStyles {
  return {
    fontSize: { desktop: 16 },
    textAlign: { desktop: "left" },
    padding: { desktop: emptySpacing(0) },
    margin: { desktop: emptySpacing(0) },
    background: { kind: "none" },
    borderWidth: 0,
    borderRadius: 0,
    borderColor: "transparent",
    shadow: "none",
  };
}

export function createIdFactory(prefix = "pf"): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

export function defaultColumnWidths(count: number): Record<PaidFunnelBreakpoint, number> {
  const width = Math.floor((100 / count) * 100) / 100;
  const last = Math.round((100 - width * (count - 1)) * 100) / 100;
  return { desktop: last, tablet: last, mobile: 100 };
}

export function createColumn(
  nextId: () => string,
  elements: FunnelElement[] = [],
  count = 1,
): FunnelColumn {
  return {
    id: nextId(),
    kind: "column",
    widths: defaultColumnWidths(count),
    alignment: "left",
    padding: { desktop: emptySpacing(16) },
    background: { kind: "none" },
    borderColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    visibility: defaultVisibility(),
    elements,
  };
}

export function createRow(nextId: () => string, columns: FunnelColumn[]): FunnelRow {
  return {
    id: nextId(),
    kind: "row",
    gap: 16,
    valign: "top",
    wrap: true,
    background: { kind: "none" },
    padding: { desktop: emptySpacing(0) },
    columns,
  };
}

export function createSection(
  nextId: () => string,
  input: Partial<FunnelSection> & { rows: FunnelRow[] },
): FunnelSection {
  return {
    id: nextId(),
    kind: "section",
    preset: "blank",
    layout: "boxed",
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
    visibility: defaultVisibility(),
    ...input,
  };
}

export function createElement(
  nextId: () => string,
  type: PaidFunnelElementType,
  props: Record<string, unknown> = {},
  styles: Partial<ElementStyles> = {},
): FunnelElement {
  return {
    id: nextId(),
    kind: "element",
    type,
    props: defaultElementProps(type, props),
    styles: { ...defaultElementStyles(), ...styles },
    visibility: defaultVisibility(),
  };
}

export function defaultElementProps(
  type: PaidFunnelElementType,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults: Record<PaidFunnelElementType, Record<string, unknown>> = {
    heading: { text: "Headline", tag: "h2" },
    text: { text: "Supporting copy for this paid-ad step." },
    image: { src: "", alt: "", filename: "" },
    button: { label: "Continue", action: { type: "nextStep" } satisfies ButtonAction },
    icon: { name: "sparkles" },
    video: { src: "", filename: "" },
    spacer: { height: 24 },
    divider: {},
    list: { items: ["Benefit one", "Benefit two"] },
    form: {
      formId: "lead-form",
      fields: ["firstName", "lastName", "email", "phone", "consent"],
      submitLabel: "Get pricing",
    },
    multipleChoice: {
      field: "surveyAnswer",
      question: "Choose the answer that fits best.",
      options: ["Option one", "Option two", "Option three"],
      autoAdvance: true,
    },
    shortAnswer: {
      field: "surveyAnswer",
      question: "Tell us a little more.",
      placeholder: "Type your answer",
      required: true,
    },
    phoneCta: { label: "Call now", tel: "" },
    countdown: { endsAt: "", label: "Offer ends" },
    testimonial: { quote: "The process was straightforward and the team followed through.", author: "Jordan", role: "Customer" },
    faq: {
      items: [
        { question: "What happens next?", answer: "A specialist reviews your request and contacts you with the right next step." },
      ],
    },
    inventory: { slots: 5, heading: "Available options" },
    map: { address: "" },
    html: { markup: "" },
  };
  return { ...defaults[type], ...overrides };
}

export function createEmptyPage(nextId: () => string, stepKey: string): FunnelPage {
  return { id: nextId(), kind: "page", stepKey, sections: [] };
}

export function createEmptyGraph(input: {
  funnelKey: string;
  name: string;
  nextId?: () => string;
}): PaidFunnelGraph {
  const nextId = input.nextId ?? createIdFactory(input.funnelKey);
  const landing = createEmptyPage(nextId, "landing");
  return {
    schemaVersion: PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
    kind: PAID_FUNNEL_KIND,
    funnelKey: input.funnelKey,
    name: input.name,
    version: 1,
    steps: [
      {
        key: "landing",
        type: "landing",
        slug: "/",
        title: "Landing",
        seo: { title: `${input.name} | Offer`, description: "Paid ads landing page." },
        nextStep: { type: "none" },
        tracking: {
          browserEvent: "ViewContent",
          serverEvent: "ViewContent",
        },
        previewState: "draft",
        publishState: "draft",
      },
    ],
    pages: { landing },
    globalStyles: defaultGlobalStyles(),
    reusableSections: [],
  };
}

export function cloneNode<T>(value: T): T {
  return structuredClone(value);
}

export function visitNodes(
  graph: PaidFunnelGraph,
  visit: (node: GraphNode, parent: GraphNode | null, page: FunnelPage) => void,
): void {
  for (const step of graph.steps) {
    const page = graph.pages[step.key];
    if (!page) continue;
    visit(page, null, page);
    for (const section of page.sections) {
      visit(section, page, page);
      for (const row of section.rows) {
        visit(row, section, page);
        for (const column of row.columns) {
          visit(column, row, page);
          for (const element of column.elements) {
            visit(element, column, page);
          }
        }
      }
    }
  }
}

export function findNode(
  graph: PaidFunnelGraph,
  id: string,
): { node: GraphNode; parent: GraphNode | null; page: FunnelPage } | null {
  let found: { node: GraphNode; parent: GraphNode | null; page: FunnelPage } | null = null;
  visitNodes(graph, (node, parent, page) => {
    if (node.id === id) found = { node, parent, page };
  });
  return found;
}

export function listChildIds(node: GraphNode): string[] {
  if (node.kind === "page") return node.sections.map(child => child.id);
  if (node.kind === "section") return node.rows.map(child => child.id);
  if (node.kind === "row") return node.columns.map(child => child.id);
  if (node.kind === "column") return node.elements.map(child => child.id);
  return [];
}

export const boxSpacingSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});

export const paidFunnelGraphSchema: z.ZodType<PaidFunnelGraph> = z.lazy(() =>
  z.object({
    schemaVersion: z.literal(PAID_FUNNEL_GRAPH_SCHEMA_VERSION),
    kind: z.literal(PAID_FUNNEL_KIND),
    funnelKey: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive(),
    steps: z.array(
      z.object({
        key: z.string().min(1),
        type: z.enum(PAID_FUNNEL_STEP_TYPES),
        slug: z.string().min(1),
        title: z.string().min(1),
        seo: z.object({
          title: z.string(),
          description: z.string(),
          shareImage: z.string().optional(),
        }),
        nextStep: z.union([
          z.object({ type: z.literal("step"), stepKey: z.string() }),
          z.object({ type: z.literal("redirect"), url: z.string() }),
          z.object({ type: z.literal("none") }),
        ]),
        tracking: z.object({
          browserEvent: z.string().min(1),
          serverEvent: z.string().min(1),
          answerField: z.string().min(1).optional(),
        }).optional(),
        previewState: z.enum(PAID_FUNNEL_STEP_STATE_VALUES),
        publishState: z.enum(PAID_FUNNEL_STEP_STATE_VALUES),
      }),
    ),
    pages: z.record(
      z.string(),
      z.object({
        id: z.string(),
        kind: z.literal("page"),
        stepKey: z.string(),
        sections: z.array(z.any()),
      }),
    ),
    globalStyles: z.any(),
    reusableSections: z.array(z.any()),
  }),
) as z.ZodType<PaidFunnelGraph>;

export function migratePaidFunnelGraph(input: unknown): PaidFunnelGraph {
  if (!input || typeof input !== "object") {
    throw new Error("Paid funnel graph is missing.");
  }
  const raw = input as Record<string, unknown>;
  const version = raw.schemaVersion ?? 0;
  if (version === 0 && raw.blocks) {
    throw new Error("Flat website block lists cannot migrate into a paid-funnel graph.");
  }
  if (raw.kind && raw.kind !== PAID_FUNNEL_KIND) {
    throw new Error("Only paid-funnel graphs can be opened in this builder.");
  }
  const parsed = paidFunnelGraphSchema.parse({
    ...raw,
    schemaVersion: PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
    kind: PAID_FUNNEL_KIND,
  });
  for (const step of parsed.steps) {
    if (!parsed.pages[step.key]) {
      throw new Error(`Funnel step "${step.key}" is missing its page graph.`);
    }
  }
  return parsed;
}

export function stepHasLeadForm(graph: PaidFunnelGraph, stepKey: string): boolean {
  const page = graph.pages[stepKey];
  if (!page) return false;
  let found = false;
  visitNodes({ ...graph, steps: graph.steps.filter(step => step.key === stepKey) }, node => {
    if (node.kind === "element" && (node.type === "form" || node.type === "phoneCta")) {
      found = true;
    }
  });
  return found;
}

export const CANONICAL_OFFLINE_CONVERSION_CONTRACT = SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT;
