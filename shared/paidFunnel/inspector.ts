import { emptySpacing, findNode, type BoxSpacing, type GraphNode, type PaidFunnelBreakpoint, type PaidFunnelGraph, type ResponsiveValue } from "./graph";

export type InspectorControl =
  | "layout"
  | "maxWidth"
  | "minHeight"
  | "alignment"
  | "padding"
  | "margin"
  | "background"
  | "overlay"
  | "border"
  | "radius"
  | "shadow"
  | "sticky"
  | "anchor"
  | "className"
  | "visibility"
  | "duplicate"
  | "saveReusable"
  | "delete"
  | "gap"
  | "valign"
  | "wrap"
  | "columns"
  | "width"
  | "elementOrder"
  | "typography"
  | "spacing"
  | "color"
  | "link"
  | "action"
  | "responsive";

const SECTION_CONTROLS: InspectorControl[] = [
  "layout", "maxWidth", "minHeight", "alignment", "padding", "margin", "background", "overlay",
  "border", "radius", "shadow", "sticky", "anchor", "className", "visibility", "duplicate", "saveReusable", "delete",
];
const ROW_CONTROLS: InspectorControl[] = ["gap", "valign", "wrap", "background", "padding", "columns", "duplicate", "delete"];
const COLUMN_CONTROLS: InspectorControl[] = ["width", "alignment", "padding", "background", "border", "visibility", "elementOrder", "duplicate", "delete"];
const ELEMENT_CONTROLS: InspectorControl[] = [
  "typography", "spacing", "color", "border", "alignment", "link", "action", "responsive", "visibility", "duplicate", "delete",
];

export type InspectorModel = {
  id: string;
  kind: GraphNode["kind"];
  title: string;
  breakpoint: PaidFunnelBreakpoint;
  controls: InspectorControl[];
  values: Record<string, unknown>;
};

export function inspectorModel(
  graph: PaidFunnelGraph,
  selectedId: string | null,
  breakpoint: PaidFunnelBreakpoint,
): InspectorModel | null {
  if (!selectedId) return null;
  const found = findNode(graph, selectedId);
  if (!found) return null;
  const { node } = found;
  if (node.kind === "section") {
    return {
      id: node.id,
      kind: node.kind,
      title: `Section · ${node.preset}`,
      breakpoint,
      controls: SECTION_CONTROLS,
      values: {
        layout: node.layout,
        maxWidth: node.maxWidth,
        minHeight: node.minHeight,
        alignment: node.alignment,
        padding: node.padding,
        margin: node.margin,
        background: node.background,
        overlay: node.overlay,
        borderColor: node.borderColor,
        borderWidth: node.borderWidth,
        radius: node.borderRadius,
        shadow: node.shadow,
        sticky: node.sticky,
        anchor: node.anchor,
        className: node.className,
        visibility: node.visibility,
      },
    };
  }
  if (node.kind === "row") {
    return {
      id: node.id,
      kind: node.kind,
      title: "Row",
      breakpoint,
      controls: ROW_CONTROLS,
      values: {
        gap: node.gap,
        valign: node.valign,
        wrap: node.wrap,
        background: node.background,
        padding: node.padding,
        columns: node.columns.map(column => column.widths[breakpoint]),
      },
    };
  }
  if (node.kind === "column") {
    return {
      id: node.id,
      kind: node.kind,
      title: "Column",
      breakpoint,
      controls: COLUMN_CONTROLS,
      values: {
        width: node.widths,
        alignment: node.alignment,
        padding: node.padding,
        background: node.background,
        borderColor: node.borderColor,
        visibility: node.visibility,
        elementOrder: node.elements.map(element => element.id),
      },
    };
  }
  if (node.kind === "element") {
    return {
      id: node.id,
      kind: node.kind,
      title: `Element · ${node.type}`,
      breakpoint,
      controls: ELEMENT_CONTROLS,
      values: {
        type: node.type,
        props: node.props,
        styles: node.styles,
        visibility: node.visibility,
        action: node.props.action,
      },
    };
  }
  return {
    id: node.id,
    kind: node.kind,
    title: `Page · ${node.stepKey}`,
    breakpoint,
    controls: [],
    values: { stepKey: node.stepKey, sectionCount: node.sections.length },
  };
}

export const BUTTON_ACTION_TYPES = ["nextStep", "step", "url", "phone", "formSubmit", "booking", "conditional"] as const;

export function currentSpacing(
  value: ResponsiveValue<BoxSpacing> | undefined,
  breakpoint: PaidFunnelBreakpoint,
): BoxSpacing {
  if (breakpoint === "mobile") return value?.mobile ?? value?.tablet ?? value?.desktop ?? emptySpacing();
  if (breakpoint === "tablet") return value?.tablet ?? value?.desktop ?? emptySpacing();
  return value?.desktop ?? emptySpacing();
}
