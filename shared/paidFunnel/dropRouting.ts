import {
  PAID_FUNNEL_ELEMENT_TYPES,
  PAID_FUNNEL_NODE_KINDS,
  PAID_FUNNEL_SECTION_PRESETS,
  type PaidFunnelElementType,
  type PaidFunnelGraph,
  type PaidFunnelNodeKind,
  type PaidFunnelSectionPreset,
  findNode,
  listChildIds,
} from "./graph";
import {
  isValidDrop,
  type DropTarget,
  type PaletteItem,
  type StudioClipboard,
} from "./ops";

export type ActivePaletteDrag = { type: "palette"; item: PaletteItem };
export type ActiveNodeDrag = { type: "node"; id: string; nodeKind: Exclude<PaidFunnelNodeKind, "page"> };
export type ActiveDrag = ActivePaletteDrag | ActiveNodeDrag;

export type CanvasEventFlags = {
  preventDefault: boolean;
  stopPropagation: boolean;
  accepted: boolean;
};

const PRESETS = new Set<string>(PAID_FUNNEL_SECTION_PRESETS);
const ELEMENT_TYPES = new Set<string>(PAID_FUNNEL_ELEMENT_TYPES);
const NODE_KINDS = new Set<string>(PAID_FUNNEL_NODE_KINDS);

export function parsePalettePayload(raw: unknown): PaletteItem | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.source === "section" && typeof item.preset === "string" && PRESETS.has(item.preset)) {
    return { source: "section", preset: item.preset as PaidFunnelSectionPreset };
  }
  if (item.source === "row" && (item.columns === 1 || item.columns === 2 || item.columns === 3)) {
    return { source: "row", columns: item.columns };
  }
  if (item.source === "element" && typeof item.type === "string" && ELEMENT_TYPES.has(item.type)) {
    return { source: "element", type: item.type as PaidFunnelElementType };
  }
  if (item.source === "reusable" && typeof item.reusableId === "string" && item.reusableId.trim()) {
    return { source: "reusable", reusableId: item.reusableId };
  }
  return null;
}

export function dropComparable(active: ActiveDrag | PaletteItem | StudioClipboard | null): PaletteItem | StudioClipboard | null {
  if (!active) return null;
  if ("source" in active) return active;
  if ("type" in active && active.type === "palette") return active.item;
  if ("type" in active && active.type === "node") {
    return { kind: active.nodeKind, node: { id: active.id, kind: active.nodeKind } } as StudioClipboard;
  }
  if ("kind" in active) return active;
  return null;
}

export function asDropParentKind(kind: string): PaidFunnelNodeKind | null {
  return NODE_KINDS.has(kind) && kind !== "element" ? (kind as PaidFunnelNodeKind) : null;
}

export function canvasDragEventFlags(
  target: { parentId: string; parentKind: string; index: number },
  active: ActiveDrag | PaletteItem | StudioClipboard | null,
): CanvasEventFlags {
  const item = dropComparable(active);
  const parentKind = asDropParentKind(target.parentKind);
  if (!item || !parentKind) {
    return { preventDefault: false, stopPropagation: false, accepted: false };
  }
  const ok = isValidDrop({ parentId: target.parentId, parentKind, index: target.index }, item);
  return { preventDefault: ok, stopPropagation: ok, accepted: ok };
}

export function routeCanvasEvent(
  pathInnermostFirst: Array<{ parentId: string; parentKind: string; index: number }>,
  active: ActiveDrag | PaletteItem | StudioClipboard,
): {
  accepted: DropTarget | null;
  stoppedAt: string | null;
  flags: CanvasEventFlags[];
} {
  const flags: CanvasEventFlags[] = [];
  for (const target of pathInnermostFirst) {
    const flag = canvasDragEventFlags(target, active);
    flags.push(flag);
    if (flag.accepted) {
      const parentKind = asDropParentKind(target.parentKind);
      if (!parentKind) continue;
      return {
        accepted: { parentId: target.parentId, parentKind, index: target.index },
        stoppedAt: target.parentId,
        flags,
      };
    }
  }
  return { accepted: null, stoppedAt: null, flags };
}

export function simulateCanvasInteraction(
  pathInnermostFirst: Array<{ parentId: string; parentKind: string; index: number }>,
  active: PaletteItem | StudioClipboard,
  insert: (target: DropTarget, item: PaletteItem | StudioClipboard) => void,
): { accepted: DropTarget | null; stopped: boolean; inserted: boolean } {
  const routed = routeCanvasEvent(pathInnermostFirst, active);
  if (routed.accepted) insert(routed.accepted, active);
  return {
    accepted: routed.accepted,
    stopped: routed.stoppedAt != null,
    inserted: routed.accepted != null,
  };
}

export function dropIndexFromMidpoints(
  children: Array<{ start: number; end: number }>,
  pointer: number,
): number {
  if (children.length === 0) return 0;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    const mid = (child.start + child.end) / 2;
    if (pointer < mid) return index;
  }
  return children.length;
}

export function childAxisRects(elements: Array<{ start: number; size: number }>): Array<{ start: number; end: number }> {
  return elements.map(el => ({ start: el.start, end: el.start + el.size }));
}

export function dropIndexFromChildRects(
  children: readonly { top: number; height: number; left: number; width: number }[],
  pointer: { x: number; y: number },
  axis: "vertical" | "horizontal",
): number {
  const spans = childAxisRects(children.map(rect => axis === "horizontal"
    ? { start: rect.left, size: rect.width }
    : { start: rect.top, size: rect.height }));
  return dropIndexFromMidpoints(spans, axis === "horizontal" ? pointer.x : pointer.y);
}

export function compatibleTargetKinds(active: ActiveDrag | PaletteItem | StudioClipboard | null): PaidFunnelNodeKind[] {
  const item = dropComparable(active);
  if (!item) return [];
  return (["page", "section", "row", "column"] as const).filter(parentKind =>
    isValidDrop({ parentId: "probe", parentKind, index: 0 }, item),
  );
}

export function canvasNodeLabel(kind: string, label: string): string {
  return `${kind} ${label}`.trim();
}

export function paletteItemLabel(item: PaletteItem): string {
  if (item.source === "section") return `Add ${item.preset} section`;
  if (item.source === "row") return `Add ${item.columns}-column row`;
  if (item.source === "reusable") return `Add reusable section ${item.reusableId}`;
  return `Add ${item.type} element`;
}

export function isDescendantId(graph: PaidFunnelGraph, ancestorId: string, maybeChildId: string): boolean {
  const ancestor = findNode(graph, ancestorId);
  if (!ancestor) return false;
  const walk = (id: string): boolean => {
    const found = findNode(graph, id);
    if (!found) return false;
    if (found.node.id === maybeChildId) return true;
    return listChildIds(found.node).some(walk);
  };
  return listChildIds(ancestor.node).some(walk);
}

export function canMoveNodeTo(graph: PaidFunnelGraph, id: string, target: DropTarget): boolean {
  const found = findNode(graph, id);
  if (!found || !found.parent || found.node.kind === "page") return false;
  if (found.node.id === target.parentId || isDescendantId(graph, id, target.parentId)) return false;
  if (
    found.node.kind === "column"
    && found.parent.kind === "row"
    && found.parent.id !== target.parentId
    && found.parent.columns.length <= 1
  ) return false;
  return isValidDrop(target, { kind: found.node.kind, node: found.node } as StudioClipboard);
}

export function siblingIndexTarget(
  graph: PaidFunnelGraph,
  id: string,
  delta: -1 | 1,
): DropTarget | null {
  const found = findNode(graph, id);
  if (!found?.parent) return null;
  const ids = listChildIds(found.parent);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  return { parentId: found.parent.id, parentKind: found.parent.kind, index: delta > 0 ? to + 1 : to };
}

export const POINTER_DRAG_THRESHOLD = 6;

export function pointerDragStarted(startX: number, startY: number, x: number, y: number): boolean {
  const dx = x - startX;
  const dy = y - startY;
  return dx * dx + dy * dy >= POINTER_DRAG_THRESHOLD * POINTER_DRAG_THRESHOLD;
}
