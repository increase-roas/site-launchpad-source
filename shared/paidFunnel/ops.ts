import {
  type Background,
  type BoxSpacing,
  type ButtonAction,
  type DeviceVisibility,
  type FunnelColumn,
  type FunnelElement,
  type FunnelPage,
  type FunnelRow,
  type FunnelSection,
  type GlobalFunnelStyles,
  type GraphNode,
  type PaidFunnelBreakpoint,
  type PaidFunnelElementType,
  type PaidFunnelGraph,
  type PaidFunnelNodeKind,
  type PaidFunnelSectionPreset,
  type PaidFunnelStep,
  type PaidFunnelStepState,
  type ResponsiveValue,
  cloneNode,
  createColumn,
  createElement,
  createIdFactory,
  createRow,
  createSection,
  defaultColumnWidths,
  emptySpacing,
  findNode,
  listChildIds,
} from "./graph";

export type DropKind = "section" | "row" | "column" | "element" | "preset" | "reusable";

export type DropTarget = {
  parentId: string;
  parentKind: PaidFunnelNodeKind;
  index: number;
};

export type PaletteItem =
  | { source: "section"; preset: PaidFunnelSectionPreset }
  | { source: "row"; columns: 1 | 2 | 3 }
  | { source: "element"; type: PaidFunnelElementType }
  | { source: "reusable"; reusableId: string };

export type StudioClipboard =
  | { kind: "section"; node: FunnelSection }
  | { kind: "row"; node: FunnelRow }
  | { kind: "column"; node: FunnelColumn }
  | { kind: "element"; node: FunnelElement };

function isPaletteItem(item: PaletteItem | StudioClipboard): item is PaletteItem {
  return "source" in item;
}

export function isValidDrop(target: DropTarget, item: PaletteItem | StudioClipboard): boolean {
  if ((isPaletteItem(item) && (item.source === "section" || item.source === "reusable")) || ("kind" in item && item.kind === "section")) {
    return target.parentKind === "page";
  }
  if ((isPaletteItem(item) && item.source === "row") || ("kind" in item && item.kind === "row")) {
    return target.parentKind === "section";
  }
  if ("kind" in item && item.kind === "column") {
    return target.parentKind === "row";
  }
  return target.parentKind === "column";
}

export function dropTargetsForItem(
  graph: PaidFunnelGraph,
  stepKey: string,
  item: PaletteItem | StudioClipboard,
): DropTarget[] {
  const page = graph.pages[stepKey];
  if (!page) return [];
  const targets: DropTarget[] = [];
  if (isValidDrop({ parentId: page.id, parentKind: "page", index: 0 }, item)) {
    for (let index = 0; index <= page.sections.length; index += 1) {
      targets.push({ parentId: page.id, parentKind: "page", index });
    }
  }
  for (const section of page.sections) {
    if (isValidDrop({ parentId: section.id, parentKind: "section", index: 0 }, item)) {
      for (let index = 0; index <= section.rows.length; index += 1) {
        targets.push({ parentId: section.id, parentKind: "section", index });
      }
    }
    for (const row of section.rows) {
      if (isValidDrop({ parentId: row.id, parentKind: "row", index: 0 }, item)) {
        for (let index = 0; index <= row.columns.length; index += 1) {
          targets.push({ parentId: row.id, parentKind: "row", index });
        }
      }
      for (const column of row.columns) {
        if (isValidDrop({ parentId: column.id, parentKind: "column", index: 0 }, item)) {
          for (let index = 0; index <= column.elements.length; index += 1) {
            targets.push({ parentId: column.id, parentKind: "column", index });
          }
        }
      }
    }
  }
  return targets;
}

function insertAt<T>(list: T[], index: number, value: T): T[] {
  const next = list.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, value);
  return next;
}

function moveItem<T extends { id: string }>(list: T[], id: string, toIndex: number): T[] {
  const from = list.findIndex(item => item.id === id);
  if (from < 0) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  const target = Math.max(0, Math.min(toIndex > from ? toIndex - 1 : toIndex, next.length));
  next.splice(target, 0, item);
  return next;
}

function retargetIds<T>(value: T, nextId: () => string): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      copy[key] = key === "id" && typeof child === "string" ? nextId() : walk(child);
    }
    return copy;
  };
  return walk(value) as T;
}

function mutatePage(graph: PaidFunnelGraph, pageId: string, update: (page: FunnelPage) => FunnelPage): PaidFunnelGraph {
  const next = cloneNode(graph);
  for (const [key, page] of Object.entries(next.pages)) {
    if (page.id === pageId) next.pages[key] = update(page);
  }
  return next;
}

function mutateById(graph: PaidFunnelGraph, id: string, update: (node: GraphNode) => GraphNode): PaidFunnelGraph {
  const next = cloneNode(graph);
  const apply = (node: GraphNode): GraphNode => {
    if (node.id === id) return update(node);
    if (node.kind === "page") return { ...node, sections: node.sections.map(child => apply(child) as FunnelSection) };
    if (node.kind === "section") return { ...node, rows: node.rows.map(child => apply(child) as FunnelRow) };
    if (node.kind === "row") return { ...node, columns: node.columns.map(child => apply(child) as FunnelColumn) };
    if (node.kind === "column") return { ...node, elements: node.elements.map(child => apply(child) as FunnelElement) };
    return node;
  };
  for (const [key, page] of Object.entries(next.pages)) {
    next.pages[key] = apply(page) as FunnelPage;
  }
  return next;
}

export function insertPaletteItem(
  graph: PaidFunnelGraph,
  target: DropTarget,
  item: PaletteItem,
  createPreset: (preset: PaidFunnelSectionPreset, nextId: () => string) => FunnelSection,
  nextId = createIdFactory("ins"),
): PaidFunnelGraph {
  if (!isValidDrop(target, item)) {
    throw new Error("That block cannot be dropped on this target.");
  }
  if (item.source === "reusable") {
    const reusable = graph.reusableSections.find(entry => entry.id === item.reusableId);
    if (!reusable) throw new Error("Reusable section was not found.");
    const section = retargetIds(cloneNode(reusable.section), nextId);
    return mutateById(graph, target.parentId, node => {
      if (node.kind !== "page") return node;
      return { ...node, sections: insertAt(node.sections, target.index, section) };
    });
  }
  if (item.source === "section") {
    const section = createPreset(item.preset, nextId);
    return mutateById(graph, target.parentId, node => {
      if (node.kind !== "page") return node;
      return { ...node, sections: insertAt(node.sections, target.index, section) };
    });
  }
  if (item.source === "row") {
    const columns = Array.from({ length: item.columns }, () => createColumn(nextId, [], item.columns));
    const row = createRow(nextId, columns);
    return mutateById(graph, target.parentId, node => {
      if (node.kind !== "section") return node;
      return { ...node, rows: insertAt(node.rows, target.index, row) };
    });
  }
  const element = createElement(nextId, item.type);
  return mutateById(graph, target.parentId, node => {
    if (node.kind !== "column") return node;
    return { ...node, elements: insertAt(node.elements, target.index, element) };
  });
}

export function reorderNode(graph: PaidFunnelGraph, id: string, toIndex: number): PaidFunnelGraph {
  const found = findNode(graph, id);
  if (!found?.parent) throw new Error("The page itself cannot be reordered.");
  return mutateById(graph, found.parent.id, node => {
    if (node.kind === "page") return { ...node, sections: moveItem(node.sections, id, toIndex) };
    if (node.kind === "section") return { ...node, rows: moveItem(node.rows, id, toIndex) };
    if (node.kind === "row") return { ...node, columns: moveItem(node.columns, id, toIndex) };
    if (node.kind === "column") return { ...node, elements: moveItem(node.elements, id, toIndex) };
    return node;
  });
}

export function resizeColumns(
  graph: PaidFunnelGraph,
  rowId: string,
  widths: number[],
  breakpoint: PaidFunnelBreakpoint,
): PaidFunnelGraph {
  const found = findNode(graph, rowId);
  if (!found || found.node.kind !== "row") throw new Error("Columns can only be resized on a row.");
  if (widths.length !== found.node.columns.length) {
    throw new Error("Provide a width for every column.");
  }
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (Math.abs(total - 100) > 0.05) {
    throw new Error("Column widths must add up to 100%.");
  }
  return mutateById(graph, rowId, node => {
    if (node.kind !== "row") return node;
    return {
      ...node,
      columns: node.columns.map((column, index) => ({
        ...column,
        widths: { ...column.widths, [breakpoint]: widths[index] ?? column.widths[breakpoint] },
      })),
    };
  });
}

export function duplicateNode(graph: PaidFunnelGraph, id: string, nextId = createIdFactory("dup")): PaidFunnelGraph {
  const found = findNode(graph, id);
  if (!found?.parent) throw new Error("The page cannot be duplicated.");
  const clone = retargetIds(cloneNode(found.node), nextId);
  return mutateById(graph, found.parent.id, node => {
    const ids = listChildIds(node);
    const index = ids.indexOf(id) + 1;
    if (node.kind === "page") return { ...node, sections: insertAt(node.sections, index, clone as FunnelSection) };
    if (node.kind === "section") return { ...node, rows: insertAt(node.rows, index, clone as FunnelRow) };
    if (node.kind === "row") return { ...node, columns: insertAt(node.columns, index, clone as FunnelColumn) };
    if (node.kind === "column") return { ...node, elements: insertAt(node.elements, index, clone as FunnelElement) };
    return node;
  });
}

export function deleteNode(graph: PaidFunnelGraph, id: string): PaidFunnelGraph {
  const found = findNode(graph, id);
  if (!found?.parent) throw new Error("The page cannot be deleted.");
  return mutateById(graph, found.parent.id, node => {
    if (node.kind === "page") return { ...node, sections: node.sections.filter(child => child.id !== id) };
    if (node.kind === "section") return { ...node, rows: node.rows.filter(child => child.id !== id) };
    if (node.kind === "row") {
      if (node.columns.length <= 1 && node.columns[0]?.id === id) {
        throw new Error("A row must keep at least one column.");
      }
      const columns = node.columns.filter(child => child.id !== id);
      const widths = columns.map((_, index, list) => defaultColumnWidths(list.length).desktop);
      return {
        ...node,
        columns: columns.map((column, index) => ({
          ...column,
          widths: { desktop: widths[index] ?? 100, tablet: widths[index] ?? 100, mobile: 100 },
        })),
      };
    }
    if (node.kind === "column") return { ...node, elements: node.elements.filter(child => child.id !== id) };
    return node;
  });
}

export function updateSection(graph: PaidFunnelGraph, id: string, patch: Partial<FunnelSection>): PaidFunnelGraph {
  return mutateById(graph, id, node => (node.kind === "section" ? { ...node, ...patch, id: node.id, kind: "section" } : node));
}

export function updateRow(graph: PaidFunnelGraph, id: string, patch: Partial<FunnelRow>): PaidFunnelGraph {
  return mutateById(graph, id, node => (node.kind === "row" ? { ...node, ...patch, id: node.id, kind: "row" } : node));
}

export function updateColumn(graph: PaidFunnelGraph, id: string, patch: Partial<FunnelColumn>): PaidFunnelGraph {
  return mutateById(graph, id, node => (node.kind === "column" ? { ...node, ...patch, id: node.id, kind: "column" } : node));
}

export function updateElement(graph: PaidFunnelGraph, id: string, patch: Partial<FunnelElement>): PaidFunnelGraph {
  return mutateById(graph, id, node => (node.kind === "element" ? { ...node, ...patch, id: node.id, kind: "element" } : node));
}

export function setInlineText(graph: PaidFunnelGraph, id: string, text: string): PaidFunnelGraph {
  return mutateById(graph, id, node => {
    if (node.kind !== "element") return node;
    if (!("text" in node.props) && node.type !== "heading" && node.type !== "text" && node.type !== "button") {
      throw new Error("This element does not support inline text.");
    }
    const key = node.type === "button" ? "label" : node.type === "testimonial" ? "quote" : "text";
    return { ...node, props: { ...node.props, [key]: text } };
  });
}

export function attachMedia(
  graph: PaidFunnelGraph,
  id: string,
  media: { url: string; filename: string; assetId?: string },
): PaidFunnelGraph {
  return mutateById(graph, id, node => {
    if (node.kind === "element" && (node.type === "image" || node.type === "video")) {
      return {
        ...node,
        props: { ...node.props, src: media.url, filename: media.filename, assetId: media.assetId },
      };
    }
    if (node.kind === "section" || node.kind === "row" || node.kind === "column") {
      const background: Background = {
        kind: node.kind === "section" ? "image" : "image",
        url: media.url,
        filename: media.filename,
        assetId: media.assetId,
        size: "cover",
        position: "center",
      };
      return { ...node, background };
    }
    throw new Error("Media can only attach to image, video, or a background target.");
  });
}

export function setButtonAction(graph: PaidFunnelGraph, id: string, action: ButtonAction): PaidFunnelGraph {
  return mutateById(graph, id, node => {
    if (node.kind !== "element" || (node.type !== "button" && node.type !== "phoneCta")) {
      throw new Error("Actions can only be set on buttons.");
    }
    return { ...node, props: { ...node.props, action } };
  });
}

export function setVisibility(
  graph: PaidFunnelGraph,
  id: string,
  visibility: DeviceVisibility,
): PaidFunnelGraph {
  return mutateById(graph, id, node => ("visibility" in node ? { ...node, visibility } : node));
}

export function setResponsiveSpacing(
  graph: PaidFunnelGraph,
  id: string,
  field: "padding" | "margin",
  breakpoint: PaidFunnelBreakpoint,
  spacing: BoxSpacing,
): PaidFunnelGraph {
  return mutateById(graph, id, node => {
    if (node.kind === "element") {
      const current = (node.styles[field] ?? {}) as ResponsiveValue<BoxSpacing>;
      return { ...node, styles: { ...node.styles, [field]: { ...current, [breakpoint]: spacing } } };
    }
    if (field === "margin" && node.kind !== "section") return node;
    if (!("padding" in node)) return node;
    const current = (field === "margin" && node.kind === "section" ? node.margin : node.padding) ?? {};
    const nextValue = { ...current, [breakpoint]: spacing };
    if (node.kind === "section" && field === "margin") return { ...node, margin: nextValue };
    return { ...node, padding: nextValue };
  });
}

export function setColumnWidth(
  graph: PaidFunnelGraph,
  columnId: string,
  breakpoint: PaidFunnelBreakpoint,
  width: number,
): PaidFunnelGraph {
  const found = findNode(graph, columnId);
  if (!found || found.node.kind !== "column" || !found.parent || found.parent.kind !== "row") {
    throw new Error("Column width can only be set on a column.");
  }
  const widths = found.parent.columns.map(column =>
    column.id === columnId ? width : column.widths[breakpoint],
  );
  return resizeColumns(graph, found.parent.id, widths, breakpoint);
}

export function saveReusableSection(
  graph: PaidFunnelGraph,
  sectionId: string,
  name: string,
  now = new Date().toISOString(),
  nextId = createIdFactory("reuse"),
): PaidFunnelGraph {
  const found = findNode(graph, sectionId);
  if (!found || found.node.kind !== "section") throw new Error("Only sections can be saved as reusable.");
  return {
    ...graph,
    reusableSections: [
      ...graph.reusableSections,
      { id: nextId(), name, section: cloneNode(found.node), createdAt: now },
    ],
  };
}

export function applyGlobalStyles(graph: PaidFunnelGraph, patch: Partial<GlobalFunnelStyles>): PaidFunnelGraph {
  return {
    ...graph,
    globalStyles: {
      ...graph.globalStyles,
      ...patch,
      fonts: { ...graph.globalStyles.fonts, ...patch.fonts },
      colors: { ...graph.globalStyles.colors, ...patch.colors },
      button: { ...graph.globalStyles.button, ...patch.button },
      containers: { ...graph.globalStyles.containers, ...patch.containers },
      mobile: { ...graph.globalStyles.mobile, ...patch.mobile },
    },
  };
}

export function updateStep(
  graph: PaidFunnelGraph,
  stepKey: string,
  patch: Partial<PaidFunnelStep>,
): PaidFunnelGraph {
  return {
    ...graph,
    steps: graph.steps.map(step => (step.key === stepKey ? { ...step, ...patch, key: step.key } : step)),
  };
}

export function setStepState(
  graph: PaidFunnelGraph,
  stepKey: string,
  field: "previewState" | "publishState",
  state: PaidFunnelStepState,
): PaidFunnelGraph {
  return updateStep(graph, stepKey, { [field]: state });
}

export function addFunnelStep(
  graph: PaidFunnelGraph,
  step: PaidFunnelStep,
  page: FunnelPage,
): PaidFunnelGraph {
  if (graph.pages[step.key] || graph.steps.some(existing => existing.key === step.key)) {
    throw new Error("That funnel step already exists.");
  }
  return {
    ...graph,
    steps: [...graph.steps, step],
    pages: { ...graph.pages, [step.key]: page },
  };
}

export function copyNode(graph: PaidFunnelGraph, id: string): StudioClipboard {
  const found = findNode(graph, id);
  if (!found || found.node.kind === "page") throw new Error("The page cannot be copied.");
  return { kind: found.node.kind, node: cloneNode(found.node) } as StudioClipboard;
}

export function pasteNode(
  graph: PaidFunnelGraph,
  target: DropTarget,
  clipboard: StudioClipboard,
  nextId = createIdFactory("paste"),
): PaidFunnelGraph {
  if (!isValidDrop(target, clipboard)) {
    throw new Error("Clipboard contents cannot be pasted on this target.");
  }
  const node = retargetIds(cloneNode(clipboard.node), nextId);
  return mutateById(graph, target.parentId, parent => {
    if (parent.kind === "page" && clipboard.kind === "section") {
      return { ...parent, sections: insertAt(parent.sections, target.index, node as FunnelSection) };
    }
    if (parent.kind === "section" && clipboard.kind === "row") {
      return { ...parent, rows: insertAt(parent.rows, target.index, node as FunnelRow) };
    }
    if (parent.kind === "row" && clipboard.kind === "column") {
      return { ...parent, columns: insertAt(parent.columns, target.index, node as FunnelColumn) };
    }
    if (parent.kind === "column" && clipboard.kind === "element") {
      return { ...parent, elements: insertAt(parent.elements, target.index, node as FunnelElement) };
    }
    return parent;
  });
}

export function breadcrumbFor(graph: PaidFunnelGraph, id: string): Array<{ id: string; kind: PaidFunnelNodeKind; label: string }> {
  const found = findNode(graph, id);
  if (!found) return [];
  const crumbs: Array<{ id: string; kind: PaidFunnelNodeKind; label: string }> = [
    { id: found.page.id, kind: "page", label: found.page.stepKey },
  ];
  const path: GraphNode[] = [];
  const walk = (node: GraphNode, trail: GraphNode[]): boolean => {
    if (node.id === id) {
      path.push(...trail, node);
      return true;
    }
    const children =
      node.kind === "page"
        ? node.sections
        : node.kind === "section"
          ? node.rows
          : node.kind === "row"
            ? node.columns
            : node.kind === "column"
              ? node.elements
              : [];
    return children.some(child => walk(child, [...trail, node]));
  };
  walk(found.page, []);
  return path
    .filter(node => node.kind !== "page")
    .reduce(
      (list, node) => {
        const label =
          node.kind === "section"
            ? node.preset
            : node.kind === "element"
              ? node.type
              : node.kind;
        list.push({ id: node.id, kind: node.kind, label });
        return list;
      },
      crumbs,
    );
}

export function nextStepKey(graph: PaidFunnelGraph, stepKey: string): string | null {
  const step = graph.steps.find(entry => entry.key === stepKey);
  if (!step) return null;
  if (step.nextStep.type === "step") return step.nextStep.stepKey;
  const index = graph.steps.findIndex(entry => entry.key === stepKey);
  return graph.steps[index + 1]?.key ?? null;
}

