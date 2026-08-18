import type {
  Background,
  BoxSpacing,
  FunnelElement,
  GlobalFunnelStyles,
  PaidFunnelBreakpoint,
  PaidFunnelGraph,
  ResponsiveValue,
} from "./graph";

export type CanvasBox = {
  id: string;
  kind: "page" | "section" | "row" | "column" | "element";
  label: string;
  text?: string;
  elementType?: FunnelElement["type"];
  props?: Record<string, unknown>;
  visible: boolean;
  selected: boolean;
  width?: number;
  style: Record<string, string | number>;
  children: CanvasBox[];
};

function pickResponsive<T>(
  value: ResponsiveValue<T> | undefined,
  breakpoint: PaidFunnelBreakpoint
): T | undefined {
  if (!value) return undefined;
  if (breakpoint === "mobile")
    return value.mobile ?? value.tablet ?? value.desktop;
  if (breakpoint === "tablet") return value.tablet ?? value.desktop;
  return value.desktop;
}

function spacingCss(spacing?: BoxSpacing): string | undefined {
  if (!spacing) return undefined;
  return `${spacing.top}px ${spacing.right}px ${spacing.bottom}px ${spacing.left}px`;
}

function backgroundCss(
  background: Background | undefined,
  fallback: string
): string {
  if (!background || background.kind === "none") return fallback;
  if (background.kind === "color") return background.color;
  if (background.kind === "gradient")
    return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
  if (background.kind === "image")
    return `center / ${background.size} url(${background.url})`;
  return fallback;
}

export function elementText(element: FunnelElement): string {
  if (element.type === "button" || element.type === "phoneCta")
    return String(element.props.label ?? "");
  if (element.type === "testimonial") return String(element.props.quote ?? "");
  if (element.type === "heading" || element.type === "text")
    return String(element.props.text ?? "");
  if (element.type === "form")
    return String(element.props.submitLabel ?? "Form");
  if (element.type === "multipleChoice" || element.type === "shortAnswer") {
    return String(element.props.question ?? "Survey question");
  }
  if (element.type === "inventory")
    return String(element.props.heading ?? "Inventory");
  return element.type;
}

export function renderFunnelCanvas(
  graph: PaidFunnelGraph,
  input: {
    stepKey: string;
    breakpoint: PaidFunnelBreakpoint;
    selectedId?: string | null;
  }
): CanvasBox | null {
  const page = graph.pages[input.stepKey];
  if (!page) return null;
  const styles = graph.globalStyles;
  return {
    id: page.id,
    kind: "page",
    label: input.stepKey,
    visible: true,
    selected: input.selectedId === page.id,
    style: {
      background: styles.colors.background,
      color: styles.colors.text,
      fontFamily: styles.fonts.body,
    },
    children: page.sections.map(section => {
      const visible = section.visibility[input.breakpoint];
      const padding =
        pickResponsive(section.padding, input.breakpoint) ??
        (input.breakpoint === "mobile"
          ? styles.mobile.sectionPadding
          : undefined);
      return {
        id: section.id,
        kind: "section",
        label: section.preset,
        visible,
        selected: input.selectedId === section.id,
        style: {
          display: visible ? "block" : "none",
          maxWidth:
            section.layout === "boxed"
              ? section.maxWidth
              : styles.containers.fullMaxWidth,
          minHeight: section.minHeight,
          padding: spacingCss(padding) ?? "0",
          margin:
            spacingCss(pickResponsive(section.margin, input.breakpoint)) ?? "0",
          background: backgroundCss(section.background, "transparent"),
          textAlign: section.alignment,
          position: section.sticky ? "sticky" : "relative",
          borderRadius: section.borderRadius,
          boxShadow: section.shadow,
        },
        children: section.rows.map(row => ({
          id: row.id,
          kind: "row",
          label: "row",
          visible: true,
          selected: input.selectedId === row.id,
          style: {
            display: "flex",
            flexWrap: row.wrap ? "wrap" : "nowrap",
            alignItems:
              row.valign === "center"
                ? "center"
                : row.valign === "bottom"
                  ? "flex-end"
                  : "flex-start",
            gap: input.breakpoint === "mobile" ? styles.mobile.rowGap : row.gap,
            padding:
              spacingCss(pickResponsive(row.padding, input.breakpoint)) ?? "0",
            background: backgroundCss(row.background, "transparent"),
          },
          children: row.columns.map(column => {
            const colVisible = column.visibility[input.breakpoint];
            return {
              id: column.id,
              kind: "column",
              label: "column",
              visible: colVisible,
              selected: input.selectedId === column.id,
              width: column.widths[input.breakpoint],
              style: {
                display: colVisible ? "flex" : "none",
                flexDirection: "column",
                width: `${column.widths[input.breakpoint]}%`,
                padding:
                  spacingCss(
                    pickResponsive(column.padding, input.breakpoint)
                  ) ?? "0",
                background: backgroundCss(column.background, "transparent"),
                textAlign: column.alignment,
                border: `${column.borderWidth}px solid ${column.borderColor}`,
              },
              children: column.elements.map(element =>
                renderElement(
                  element,
                  input.breakpoint,
                  input.selectedId,
                  styles
                )
              ),
            };
          }),
        })),
      };
    }),
  };
}

function renderElement(
  element: FunnelElement,
  breakpoint: PaidFunnelBreakpoint,
  selectedId: string | null | undefined,
  styles: GlobalFunnelStyles
): CanvasBox {
  const visible = element.visibility[breakpoint];
  const isButton = element.type === "button" || element.type === "phoneCta";
  return {
    id: element.id,
    kind: "element",
    label: element.type,
    text: elementText(element),
    elementType: element.type,
    props: element.props,
    visible,
    selected: selectedId === element.id,
    style: {
      display: visible ? "block" : "none",
      fontFamily: `${
        element.styles.fontFamily ??
        (element.type === "heading" ? styles.fonts.heading : styles.fonts.body)
      }, Arial, Helvetica, sans-serif`,
      fontSize: pickResponsive(element.styles.fontSize, breakpoint) ?? 16,
      fontWeight:
        element.styles.fontWeight ??
        (isButton ? styles.button.fontWeight : 500),
      lineHeight:
        element.styles.lineHeight ?? (element.type === "heading" ? 1.05 : 1.55),
      letterSpacing: element.styles.letterSpacing ?? 0,
      color:
        element.styles.color ??
        (isButton
          ? styles.button.color
          : element.type === "heading"
            ? styles.colors.heading
            : styles.colors.text),
      textAlign: pickResponsive(element.styles.textAlign, breakpoint) ?? "left",
      padding:
        spacingCss(pickResponsive(element.styles.padding, breakpoint)) ??
        (isButton
          ? `${styles.button.paddingY}px ${styles.button.paddingX}px`
          : "0"),
      margin:
        spacingCss(pickResponsive(element.styles.margin, breakpoint)) ?? "0",
      background: backgroundCss(
        element.styles.background,
        isButton ? styles.button.background : "transparent"
      ),
      width: element.styles.width
        ? `${pickResponsive(element.styles.width, breakpoint) ?? 100}%`
        : element.type === "form" ||
            element.type === "shortAnswer" ||
            element.type === "multipleChoice"
          ? "min(100%, 520px)"
          : "auto",
      maxWidth: element.styles.maxWidth
        ? `${pickResponsive(element.styles.maxWidth, breakpoint) ?? 1120}px`
        : element.type === "image" ||
            element.type === "video" ||
            element.type === "map"
          ? "100%"
          : "none",
      border: `${element.styles.borderWidth ?? 0}px solid ${element.styles.borderColor ?? "transparent"}`,
      borderRadius:
        element.styles.borderRadius ?? (isButton ? styles.button.radius : 0),
      boxShadow: element.styles.shadow ?? "none",
    },
    children: [],
  };
}

export function flattenCanvas(box: CanvasBox | null): CanvasBox[] {
  if (!box) return [];
  return [box, ...box.children.flatMap(flattenCanvas)];
}

export function dropIndexFromPointer(
  childCount: number,
  pointerY: number,
  top: number,
  height: number
): number {
  if (childCount <= 0) return 0;
  const span = Math.max(height, 1);
  const rel = (pointerY - top) / span;
  return Math.max(0, Math.min(childCount, Math.round(rel * childCount)));
}
