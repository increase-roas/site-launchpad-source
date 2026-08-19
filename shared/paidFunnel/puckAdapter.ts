import {
  createColumn,
  createElement,
  createIdFactory,
  createRow,
  createSection,
  defaultElementStyles,
  defaultVisibility,
  emptySpacing,
  type ButtonAction,
  type FunnelElement,
  type FunnelPage,
  type FunnelSection,
  type PaidFunnelElementType,
  type PaidFunnelGraph,
  type PaidFunnelStepType,
} from "./graph";

export const PUCK_COMPATIBLE_ELEMENT_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "form",
] as const satisfies readonly PaidFunnelElementType[];

export type PuckCompatibleElementType = (typeof PUCK_COMPATIBLE_ELEMENT_TYPES)[number];

export const PUCK_BLOCK_TYPES = [
  "Section",
  "Columns",
  "Heading",
  "Text",
  "Image",
  "Button",
  "Form",
] as const;

export type PuckAdapterBlockType = (typeof PUCK_BLOCK_TYPES)[number];

export type PuckAdapterBlock = {
  type: PuckAdapterBlockType;
  props: Record<string, unknown>;
};

export type PuckAdapterData = {
  content: PuckAdapterBlock[];
  root: { props?: Record<string, unknown> };
  zones?: Record<string, PuckAdapterBlock[]>;
};

const COMPATIBLE = new Set<string>(PUCK_COMPATIBLE_ELEMENT_TYPES);
const BLOCK_TYPES = new Set<string>(PUCK_BLOCK_TYPES);
const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parsePadding(value: unknown) {
  const raw = asString(value, "32px");
  const n = Number.parseInt(raw, 10);
  const size = Number.isFinite(n) ? n : 32;
  return { desktop: { top: size, right: size, bottom: size, left: size } };
}

function paddingToCss(section: FunnelSection): string {
  const box = section.padding.desktop ?? emptySpacing(32);
  return `${box.top}px`;
}

function backgroundToCss(section: FunnelSection): string {
  if (section.background.kind === "color") return section.background.color;
  return "#ffffff";
}

function usedGraphIds(graph: PaidFunnelGraph, exceptPageKey?: string): Set<string> {
  const used = new Set<string>();
  const visit = (node: { id: string; kind?: string; sections?: FunnelSection[]; rows?: FunnelSection["rows"] }) => {
    used.add(node.id);
    if ("sections" in node && node.sections) node.sections.forEach(visit);
    if ("rows" in node && node.rows) {
      for (const row of node.rows) {
        used.add(row.id);
        for (const column of row.columns) {
          used.add(column.id);
          for (const element of column.elements) used.add(element.id);
        }
      }
    }
  };
  for (const [key, page] of Object.entries(graph.pages)) {
    if (key === exceptPageKey) continue;
    visit(page);
  }
  graph.reusableSections.forEach(entry => used.add(entry.id));
  return used;
}

function createSafeIdFactory(used: Set<string>, prefix: string): (preferred?: string) => string {
  const fallback = createIdFactory(prefix);
  return (preferred?: string) => {
    const candidate = preferred?.trim() ?? "";
    if (candidate && ID_RE.test(candidate) && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let id = fallback();
    while (used.has(id)) id = fallback();
    used.add(id);
    return id;
  };
}

function blocksOf(value: unknown): PuckAdapterBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!isRecord(item) || typeof item.type !== "string" || !BLOCK_TYPES.has(item.type)) {
      return [];
    }
    return [{ type: item.type as PuckAdapterBlockType, props: isRecord(item.props) ? item.props : {} }];
  });
}

function buttonActionFromHref(href: string): ButtonAction {
  const value = href.trim();
  if (!value || value === "#" || value.startsWith("#")) return { type: "nextStep" };
  if (/^https?:\/\//i.test(value) || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return { type: "url", href: value, openInNewTab: /^https?:\/\//i.test(value) };
  }
  const stepKey = value.replace(/^\/+/, "");
  if (stepKey && ID_RE.test(stepKey)) return { type: "step", stepKey };
  return { type: "url", href: value, openInNewTab: false };
}

function hrefFromAction(action: ButtonAction | undefined): string {
  if (!action || action.type === "nextStep" || action.type === "formSubmit") return "#";
  if (action.type === "url") return action.href;
  if (action.type === "step") return `/${action.stepKey}`;
  if (action.type === "phone") return `tel:${action.tel}`;
  return "#";
}

function formFields(showPhone: boolean): string[] {
  return showPhone
    ? ["firstName", "lastName", "email", "phone", "consent"]
    : ["firstName", "lastName", "email", "consent"];
}

function elementFromBlock(
  block: PuckAdapterBlock,
  nextId: (preferred?: string) => string,
): FunnelElement | null {
  const id = nextId(asString(block.props.id));
  if (block.type === "Heading") {
    const level = asString(block.props.level, "h1");
    const tag = level === "h2" || level === "h3" ? level : "h1";
    return createElement(() => id, "heading", { text: asString(block.props.text, "Headline"), tag });
  }
  if (block.type === "Text") {
    return createElement(() => id, "text", {
      text: asString(block.props.body, asString(block.props.text, "Supporting copy for this paid-ad step.")),
    });
  }
  if (block.type === "Image") {
    return createElement(() => id, "image", {
      src: asString(block.props.src),
      alt: asString(block.props.alt),
      filename: "",
    });
  }
  if (block.type === "Button") {
    return createElement(() => id, "button", {
      label: asString(block.props.label, "Continue"),
      action: buttonActionFromHref(asString(block.props.href, "#")),
    });
  }
  if (block.type === "Form") {
    return createElement(() => id, "form", {
      formId: "lead-form",
      title: asString(block.props.title, "Contact"),
      fields: formFields(block.props.showPhone !== false),
      submitLabel: asString(block.props.submitLabel, "Get pricing"),
    });
  }
  return null;
}

function appendLeaf(section: FunnelSection, element: FunnelElement, nextId: (preferred?: string) => string) {
  section.rows.push(createRow(() => nextId(), [createColumn(() => nextId(), [element])]));
}

function appendColumns(
  section: FunnelSection,
  block: PuckAdapterBlock,
  nextId: (preferred?: string) => string,
) {
  const count = asString(block.props.count, "2") === "3" ? 3 : 2;
  const children = blocksOf(block.props.columns);
  const columns = Array.from({ length: count }, () => createColumn(() => nextId(), [], count));
  children.forEach((child, index) => {
    const element = elementFromBlock(child, nextId);
    if (element) columns[index % count]?.elements.push(element);
  });
  const row = createRow(() => nextId(asString(block.props.id)), columns);
  section.rows.push(row);
}

function defaultSection(nextId: (preferred?: string) => string, preferred?: string): FunnelSection {
  return createSection(() => nextId(preferred), {
    preset: "blank",
    layout: "boxed",
    rows: [],
    background: { kind: "color", color: "#ffffff" },
    padding: parsePadding("32px"),
  });
}

export function createBlankPuckData(title = "Blank page"): PuckAdapterData {
  return { content: [], root: { props: { title } } };
}

export function pageSupportsPuck(page: FunnelPage | undefined): boolean {
  if (!page) return false;
  for (const section of page.sections) {
    for (const row of section.rows) {
      for (const column of row.columns) {
        for (const element of column.elements) {
          if (!COMPATIBLE.has(element.type)) return false;
        }
      }
    }
  }
  return true;
}

export function graphSupportsPuck(graph: PaidFunnelGraph): boolean {
  return graph.steps.every(step => pageSupportsPuck(graph.pages[step.key]));
}

export function puckDataToPage(
  data: PuckAdapterData,
  page: FunnelPage,
  nextId: (preferred?: string) => string,
): FunnelPage {
  const sections: FunnelSection[] = [];
  let current: FunnelSection | null = null;

  const ensureSection = () => {
    if (!current) {
      current = defaultSection(nextId);
      sections.push(current);
    }
    return current;
  };

  const consume = (blocks: PuckAdapterBlock[]) => {
    for (const block of blocks) {
      if (block.type === "Section") {
        current = createSection(() => nextId(asString(block.props.id)), {
          preset: "blank",
          layout: "boxed",
          rows: [],
          background: { kind: "color", color: asString(block.props.background, "#ffffff") },
          padding: parsePadding(block.props.padding),
        });
        sections.push(current);
        consume(blocksOf(block.props.content));
        current = null;
        continue;
      }
      const section = ensureSection();
      if (block.type === "Columns") {
        appendColumns(section, block, nextId);
        continue;
      }
      const element = elementFromBlock(block, nextId);
      if (element) appendLeaf(section, element, nextId);
    }
  };

  consume(data.content);
  return { ...page, sections };
}

export function pageToPuckData(page: FunnelPage, title = page.stepKey): PuckAdapterData {
  return {
    content: page.sections.map(section => ({
      type: "Section" as const,
      props: {
        id: section.id,
        background: backgroundToCss(section),
        padding: paddingToCss(section),
        content: section.rows.flatMap(row => {
          if (row.columns.length <= 1) {
            return (row.columns[0]?.elements ?? []).map(elementToBlock);
          }
          const count = row.columns.length >= 3 ? "3" : "2";
          const columns = row.columns.slice(0, count === "3" ? 3 : 2);
          const max = Math.max(0, ...columns.map(column => column.elements.length));
          const children: PuckAdapterBlock[] = [];
          for (let index = 0; index < max; index += 1) {
            for (const column of columns) {
              const element = column.elements[index];
              if (element) children.push(elementToBlock(element));
            }
          }
          return [
            {
              type: "Columns" as const,
              props: { id: row.id, count, columns: children },
            },
          ];
        }),
      },
    })),
    root: { props: { title } },
  };
}

function elementToBlock(element: FunnelElement): PuckAdapterBlock {
  if (element.type === "heading") {
    return {
      type: "Heading",
      props: {
        id: element.id,
        text: asString(element.props.text, "Headline"),
        level: asString(element.props.tag, "h1"),
      },
    };
  }
  if (element.type === "image") {
    return {
      type: "Image",
      props: {
        id: element.id,
        src: asString(element.props.src),
        alt: asString(element.props.alt),
      },
    };
  }
  if (element.type === "button") {
    return {
      type: "Button",
      props: {
        id: element.id,
        label: asString(element.props.label, "Continue"),
        href: hrefFromAction(element.props.action as ButtonAction | undefined),
      },
    };
  }
  if (element.type === "form") {
    const fields = Array.isArray(element.props.fields) ? element.props.fields.map(String) : [];
    return {
      type: "Form",
      props: {
        id: element.id,
        title: asString(element.props.title, "Contact"),
        submitLabel: asString(element.props.submitLabel, "Get pricing"),
        showPhone: fields.includes("phone"),
      },
    };
  }
  return {
    type: "Text",
    props: {
      id: element.id,
      body: asString(element.props.text, "Supporting copy for this paid-ad step."),
    },
  };
}

export function applyPuckDataToGraph(
  graph: PaidFunnelGraph,
  stepKey: string,
  data: PuckAdapterData,
): PaidFunnelGraph {
  const page = graph.pages[stepKey];
  if (!page) return graph;
  const nextId = createSafeIdFactory(usedGraphIds(graph, stepKey), `puck-${stepKey}`);
  return {
    ...graph,
    pages: {
      ...graph.pages,
      [stepKey]: puckDataToPage(data, page, nextId),
    },
  };
}

export function puckDataFromGraph(graph: PaidFunnelGraph, stepKey: string): PuckAdapterData {
  const page = graph.pages[stepKey];
  const step = graph.steps.find(entry => entry.key === stepKey);
  if (!page) return createBlankPuckData(step?.title ?? stepKey);
  return pageToPuckData(page, step?.title ?? page.stepKey);
}

export function blankFunnelUsesPuck(graph: PaidFunnelGraph): boolean {
  return graphSupportsPuck(graph);
}

export const PUCK_PAGE_STEP_TYPES = [
  "landing",
  "form",
  "thankYou",
  "booking",
  "upsell",
] as const satisfies readonly PaidFunnelStepType[];
