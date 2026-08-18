import { findNode, listChildIds, type PaidFunnelBreakpoint, type PaidFunnelGraph } from "./graph";
import { createHistory, pushHistory, redoHistory, type HistoryState, undoHistory } from "./history";
import {
  applyGlobalStyles,
  attachMedia,
  copyNode,
  deleteNode,
  duplicateNode,
  insertPaletteItem,
  isValidDrop,
  pasteNode,
  reorderNode,
  resizeColumns,
  saveReusableSection,
  setButtonAction,
  setInlineText,
  setResponsiveSpacing,
  setVisibility,
  updateColumn,
  updateElement,
  updateRow,
  updateSection,
  type DropTarget,
  type PaletteItem,
  type StudioClipboard,
} from "./ops";
import type { BoxSpacing, ButtonAction, DeviceVisibility, FunnelColumn, FunnelElement, FunnelRow, FunnelSection, GlobalFunnelStyles } from "./graph";
import { createEmptyGraph, createIdFactory } from "./graph";
import { createSectionPreset } from "./presets";
import { createGenericPaidFunnelFixture } from "./fixture";

export type SaveStatus = "saved" | "saving" | "error";

export type PaidFunnelDocument = {
  key: string;
  clientId: number;
  revision: number;
  graph: PaidFunnelGraph;
  saveStatus: SaveStatus;
  conflict: boolean;
  funnelId?: number;
  stepId?: number;
  expectedUpdatedAt?: string;
  editSeq: number;
};

export type StudioState = {
  document: PaidFunnelDocument;
  history: HistoryState;
  selectedId: string | null;
  stepKey: string;
  device: PaidFunnelBreakpoint;
  zoom: number;
  clipboard: StudioClipboard | null;
};

export function createDocumentFromFixture(clientId: number, key = `funnel-${clientId}`): PaidFunnelDocument {
  const graph = createGenericPaidFunnelFixture(createIdFactory(key));
  graph.funnelKey = key;
  return { key, clientId, revision: 1, graph, saveStatus: "saved", conflict: false, editSeq: 0 };
}

export function createBlankDocument(clientId: number, name: string, key = `blank-${clientId}`): PaidFunnelDocument {
  return { key, clientId, revision: 1, graph: createEmptyGraph({ funnelKey: key, name }), saveStatus: "saved", conflict: false, editSeq: 0 };
}

export function createDocumentFromPersist(input: {
  clientId: number;
  funnelId: number;
  stepId: number;
  expectedUpdatedAt: Date | string;
  graph: PaidFunnelGraph;
}): PaidFunnelDocument {
  return {
    key: input.graph.funnelKey,
    clientId: input.clientId,
    funnelId: input.funnelId,
    stepId: input.stepId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt).toISOString(),
    revision: input.graph.version,
    graph: input.graph,
    saveStatus: "saved",
    conflict: false,
    editSeq: 0,
  };
}

export function createStudioState(document: PaidFunnelDocument): StudioState {
  return {
    document,
    history: createHistory(document.graph),
    selectedId: document.graph.pages[document.graph.steps[0]?.key ?? ""]?.id ?? null,
    stepKey: document.graph.steps[0]?.key ?? "landing",
    device: "desktop",
    zoom: 1,
    clipboard: null,
  };
}

export function applyGraph(state: StudioState, graph: PaidFunnelGraph): StudioState {
  return {
    ...state,
    history: pushHistory(state.history, graph),
    document: { ...state.document, graph, saveStatus: "saving", editSeq: state.document.editSeq + 1 },
  };
}

export function commitAutosave(
  state: StudioState,
  expectedRevision: number,
  persist?: { expectedUpdatedAt?: string; stepId?: number },
): StudioState {
  if (expectedRevision !== state.document.revision) {
    return { ...state, document: { ...state.document, saveStatus: "error", conflict: true } };
  }
  return {
    ...state,
    document: {
      ...state.document,
      revision: state.document.revision + 1,
      saveStatus: "saved",
      conflict: false,
      expectedUpdatedAt: persist?.expectedUpdatedAt ?? state.document.expectedUpdatedAt,
      stepId: persist?.stepId ?? state.document.stepId,
    },
  };
}

export function markStudioSaved(state: StudioState): StudioState {
  if (state.document.conflict) {
    return { ...state, document: { ...state.document, saveStatus: "error" } };
  }
  const bump = state.document.saveStatus === "saving" ? 1 : 0;
  return {
    ...state,
    document: {
      ...state.document,
      revision: state.document.revision + bump,
      saveStatus: "saved",
      conflict: false,
    },
  };
}

export function markStudioError(state: StudioState): StudioState {
  return { ...state, document: { ...state.document, saveStatus: "error" } };
}

export function undoStudio(state: StudioState): StudioState {
  const history = undoHistory(state.history);
  return { ...state, history, document: { ...state.document, graph: history.present, saveStatus: "saving", editSeq: state.document.editSeq + 1 } };
}

export function redoStudio(state: StudioState): StudioState {
  const history = redoHistory(state.history);
  return { ...state, history, document: { ...state.document, graph: history.present, saveStatus: "saving", editSeq: state.document.editSeq + 1 } };
}

export function selectStudioNode(state: StudioState, id: string | null): StudioState {
  return { ...state, selectedId: id };
}

export function setStudioStep(state: StudioState, stepKey: string): StudioState {
  if (!state.document.graph.pages[stepKey]) return state;
  return {
    ...state,
    stepKey,
    selectedId: state.document.graph.pages[stepKey]?.id ?? null,
  };
}

export function setStudioDevice(state: StudioState, device: PaidFunnelBreakpoint): StudioState {
  return { ...state, device };
}

export function setStudioZoom(state: StudioState, zoom: number): StudioState {
  return { ...state, zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 100) / 100)) };
}

export function insertStudioItem(state: StudioState, item: PaletteItem, target: DropTarget): StudioState {
  if (!isValidDrop(target, item)) return state;
  const next = applyGraph(state, insertPaletteItem(state.document.graph, target, item, createSectionPreset));
  const parent = findNode(next.document.graph, target.parentId);
  if (!parent) return next;
  const ids = listChildIds(parent.node);
  return { ...next, selectedId: ids[Math.min(target.index, ids.length - 1)] ?? next.selectedId };
}

export function dropOnto(state: StudioState, target: DropTarget, item: PaletteItem): StudioState {
  return insertStudioItem(state, item, target);
}

export function insertPaletteOnCanvas(state: StudioState, item: PaletteItem, explicit?: DropTarget): StudioState {
  if (explicit && isValidDrop(explicit, item)) return insertStudioItem(state, item, explicit);
  const page = state.document.graph.pages[state.stepKey];
  if (!page) return state;
  if (item.source === "section" || item.source === "reusable") {
    return insertStudioItem(state, item, { parentId: page.id, parentKind: "page", index: page.sections.length });
  }
  const found = state.selectedId ? findNode(state.document.graph, state.selectedId) : null;
  if (item.source === "row") {
    const section =
      found?.node.kind === "section"
        ? found.node
        : found?.parent?.kind === "section"
          ? found.parent
          : page.sections[page.sections.length - 1];
    if (!section || section.kind !== "section") return state;
    return insertStudioItem(state, item, { parentId: section.id, parentKind: "section", index: section.rows.length });
  }
  const column =
    found?.node.kind === "column"
      ? found.node
      : found?.parent?.kind === "column"
        ? found.parent
        : page.sections[0]?.rows[0]?.columns[0];
  if (!column || column.kind !== "column") return state;
  return insertStudioItem(state, item, { parentId: column.id, parentKind: "column", index: column.elements.length });
}

export function pasteOnto(state: StudioState, target: DropTarget): StudioState {
  if (!state.clipboard) return state;
  return applyGraph(state, pasteNode(state.document.graph, target, state.clipboard));
}

export function defaultPasteTarget(state: StudioState): DropTarget | null {
  if (!state.clipboard) return null;
  const page = state.document.graph.pages[state.stepKey];
  if (!page) return null;
  const clip = state.clipboard;
  if (clip.kind === "section") {
    return { parentId: page.id, parentKind: "page", index: page.sections.length };
  }
  const selected = state.selectedId ? findNode(state.document.graph, state.selectedId) : null;
  const node = selected?.node;
  if (clip.kind === "row") {
    if (node?.kind === "section") return { parentId: node.id, parentKind: "section", index: node.rows.length };
    if (selected?.parent?.kind === "section") {
      return { parentId: selected.parent.id, parentKind: "section", index: selected.parent.rows.length };
    }
    const section = page.sections[page.sections.length - 1];
    return section ? { parentId: section.id, parentKind: "section", index: section.rows.length } : null;
  }
  if (clip.kind === "column") {
    if (node?.kind === "row") return { parentId: node.id, parentKind: "row", index: node.columns.length };
    return null;
  }
  if (node?.kind === "column") return { parentId: node.id, parentKind: "column", index: node.elements.length };
  if (selected?.parent?.kind === "column") {
    return { parentId: selected.parent.id, parentKind: "column", index: selected.parent.elements.length };
  }
  const column = page.sections[0]?.rows[0]?.columns[0];
  return column ? { parentId: column.id, parentKind: "column", index: column.elements.length } : null;
}

export function applySelectedPatch(state: StudioState, patch: Record<string, unknown>): StudioState {
  if (!state.selectedId) return state;
  const found = findNode(state.document.graph, state.selectedId);
  if (!found) return state;
  if (found.node.kind === "section") return applyGraph(state, updateSection(state.document.graph, found.node.id, patch as Partial<FunnelSection>));
  if (found.node.kind === "row") return applyGraph(state, updateRow(state.document.graph, found.node.id, patch as Partial<FunnelRow>));
  if (found.node.kind === "column") return applyGraph(state, updateColumn(state.document.graph, found.node.id, patch as Partial<FunnelColumn>));
  if (found.node.kind === "element") return applyGraph(state, updateElement(state.document.graph, found.node.id, patch as Partial<FunnelElement>));
  return state;
}

export function setSelectedText(state: StudioState, text: string): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, setInlineText(state.document.graph, state.selectedId, text));
}

export function setSelectedVisibility(state: StudioState, visibility: DeviceVisibility): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, setVisibility(state.document.graph, state.selectedId, visibility));
}

export function setSelectedSpacing(
  state: StudioState,
  field: "padding" | "margin",
  spacing: BoxSpacing,
): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, setResponsiveSpacing(state.document.graph, state.selectedId, field, state.device, spacing));
}

export function setSelectedAction(state: StudioState, action: ButtonAction): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, setButtonAction(state.document.graph, state.selectedId, action));
}

export function attachSelectedMedia(
  state: StudioState,
  media: { url: string; filename: string; assetId?: string },
): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, attachMedia(state.document.graph, state.selectedId, media));
}

export function resizeSelectedRow(state: StudioState, rowId: string, widths: number[]): StudioState {
  return applyGraph(state, resizeColumns(state.document.graph, rowId, widths, state.device));
}

export function reorderSelectedChild(state: StudioState, id: string, toIndex: number): StudioState {
  return applyGraph(state, reorderNode(state.document.graph, id, toIndex));
}

export function saveSelectedReusable(state: StudioState, name: string): StudioState {
  if (!state.selectedId) return state;
  return applyGraph(state, saveReusableSection(state.document.graph, state.selectedId, name));
}

export function patchGlobalStyles(state: StudioState, patch: Partial<GlobalFunnelStyles>): StudioState {
  return applyGraph(state, applyGlobalStyles(state.document.graph, patch));
}

export function studioHotkey(
  state: StudioState,
  key: string,
  mods: { meta?: boolean; shift?: boolean },
): StudioState {
  if ((mods.meta || false) && key === "z" && !mods.shift) return undoStudio(state);
  if ((mods.meta || false) && ((key === "z" && mods.shift) || key === "y")) return redoStudio(state);
  if ((mods.meta || false) && key === "d" && state.selectedId) {
    const found = findNode(state.document.graph, state.selectedId);
    if (!found?.parent) return state;
    return applyGraph(state, duplicateNode(state.document.graph, state.selectedId));
  }
  if ((mods.meta || false) && key === "c" && state.selectedId) {
    const found = findNode(state.document.graph, state.selectedId);
    if (!found?.parent) return state;
    return { ...state, clipboard: copyNode(state.document.graph, state.selectedId) };
  }
  if ((mods.meta || false) && key === "v") {
    const target = defaultPasteTarget(state);
    return target ? pasteOnto(state, target) : state;
  }
  if (key === "Delete" || key === "Backspace") {
    if (!state.selectedId) return state;
    const found = findNode(state.document.graph, state.selectedId);
    if (!found?.parent) return state;
    return { ...applyGraph(state, deleteNode(state.document.graph, state.selectedId)), selectedId: null };
  }
  return state;
}

export function canUndoStudio(state: StudioState): boolean {
  return state.history.past.length > 0;
}

export function canRedoStudio(state: StudioState): boolean {
  return state.history.future.length > 0;
}
