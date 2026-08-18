import {
  type PaidFunnelBreakpoint,
  type PaidFunnelGraph,
  type PaidFunnelSectionPreset,
  cloneNode,
  findNode,
} from "@shared/paidFunnel/graph";
import {
  type DropTarget,
  type PaletteItem,
  type StudioClipboard,
  copyNode,
  deleteNode,
  duplicateNode,
  insertPaletteItem,
  isValidDrop,
  pasteNode,
  reorderNode,
  resizeColumns,
  saveReusableSection,
  setInlineText,
  setVisibility,
  updateColumn,
  updateElement,
  updateRow,
  updateSection,
  applyGlobalStyles,
} from "@shared/paidFunnel/ops";
import { createSectionPreset } from "@shared/paidFunnel/presets";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export type FunnelEditorSnapshot = {
  graph: PaidFunnelGraph;
  selectedId: string | null;
  activeStepKey: string;
  device: PaidFunnelBreakpoint;
  zoom: number;
  clipboard: StudioClipboard | null;
  saveStatus: SaveStatus;
  lastSavedVersion: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type KeyboardInput = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
};

export class PaidFunnelEditor {
  private graph: PaidFunnelGraph;
  private selectedId: string | null = null;
  private activeStepKey: string;
  private device: PaidFunnelBreakpoint = "desktop";
  private zoom = 1;
  private clipboard: StudioClipboard | null = null;
  private saveStatus: SaveStatus = "saved";
  private lastSavedVersion: number;
  private past: PaidFunnelGraph[] = [];
  private future: PaidFunnelGraph[] = [];

  constructor(graph: PaidFunnelGraph) {
    this.graph = cloneNode(graph);
    this.activeStepKey = graph.steps[0]?.key ?? "landing";
    this.lastSavedVersion = graph.version;
  }

  snapshot(): FunnelEditorSnapshot {
    return {
      graph: this.graph,
      selectedId: this.selectedId,
      activeStepKey: this.activeStepKey,
      device: this.device,
      zoom: this.zoom,
      clipboard: this.clipboard,
      saveStatus: this.saveStatus,
      lastSavedVersion: this.lastSavedVersion,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
  }

  select(id: string | null): void {
    this.selectedId = id;
  }

  setStep(stepKey: string): void {
    if (!this.graph.pages[stepKey]) return;
    this.activeStepKey = stepKey;
    this.selectedId = this.graph.pages[stepKey]?.id ?? null;
  }

  setDevice(device: PaidFunnelBreakpoint): void {
    this.device = device;
  }

  setZoom(zoom: number): void {
    this.zoom = Math.min(2, Math.max(0.5, zoom));
  }

  canDrop(item: PaletteItem | StudioClipboard, target: DropTarget): boolean {
    return isValidDrop(target, item);
  }

  insert(item: PaletteItem, target: DropTarget): void {
    this.commit(insertPaletteItem(this.graph, target, item, createSectionPreset));
  }

  move(id: string, target: DropTarget): void {
    const found = findNode(this.graph, id);
    if (!found) return;
    this.commit(reorderNode(this.graph, id, target.index));
  }

  resizeRow(rowId: string, widths: number[]): void {
    this.commit(resizeColumns(this.graph, rowId, widths, this.device));
  }

  duplicate(id = this.selectedId): void {
    if (!id) return;
    this.commit(duplicateNode(this.graph, id));
  }

  remove(id = this.selectedId): void {
    if (!id) return;
    this.commit(deleteNode(this.graph, id));
    if (this.selectedId === id) this.selectedId = null;
  }

  updateSelected(patch: Record<string, unknown>): void {
    if (!this.selectedId) return;
    const found = findNode(this.graph, this.selectedId);
    if (!found) return;
    if (found.node.kind === "section") this.commit(updateSection(this.graph, found.node.id, patch));
    else if (found.node.kind === "row") this.commit(updateRow(this.graph, found.node.id, patch));
    else if (found.node.kind === "column") this.commit(updateColumn(this.graph, found.node.id, patch));
    else if (found.node.kind === "element") this.commit(updateElement(this.graph, found.node.id, patch));
  }

  setText(id: string, text: string): void {
    this.commit(setInlineText(this.graph, id, text));
  }

  hideOnDevice(id: string, visible: boolean): void {
    const found = findNode(this.graph, id);
    if (!found || !("visibility" in found.node)) return;
    this.commit(setVisibility(this.graph, id, { ...found.node.visibility, [this.device]: visible }));
  }

  copy(id = this.selectedId): void {
    if (!id) return;
    this.clipboard = copyNode(this.graph, id);
  }

  paste(target: DropTarget): void {
    if (!this.clipboard) return;
    this.commit(pasteNode(this.graph, target, this.clipboard));
  }

  saveReusable(name: string, sectionId = this.selectedId): void {
    if (!sectionId) return;
    this.commit(saveReusableSection(this.graph, sectionId, name));
  }

  insertPreset(preset: PaidFunnelSectionPreset, index: number): void {
    const page = this.graph.pages[this.activeStepKey];
    if (!page) return;
    this.insert({ source: "section", preset }, { parentId: page.id, parentKind: "page", index });
  }

  patchGlobal(patch: Parameters<typeof applyGlobalStyles>[1]): void {
    this.commit(applyGlobalStyles(this.graph, patch));
  }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.graph);
    this.graph = previous;
    this.markDirty();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.graph);
    this.graph = next;
    this.markDirty();
  }

  handleKeyboard(input: KeyboardInput): boolean {
    const chord = input.metaKey || input.ctrlKey;
    if (chord && input.key.toLowerCase() === "z") {
      if (input.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (chord && input.key.toLowerCase() === "d") {
      this.duplicate();
      return true;
    }
    if (chord && input.key.toLowerCase() === "c") {
      this.copy();
      return true;
    }
    if (input.key === "Delete" || input.key === "Backspace") {
      this.remove();
      return true;
    }
    return false;
  }

  markSaving(): void {
    this.saveStatus = "saving";
  }

  markSaved(version = this.graph.version): void {
    this.saveStatus = "saved";
    this.lastSavedVersion = version;
    this.graph = { ...this.graph, version };
  }

  markError(): void {
    this.saveStatus = "error";
  }

  detectConflict(remoteVersion: number): boolean {
    if (remoteVersion !== this.lastSavedVersion && this.saveStatus === "dirty") {
      this.saveStatus = "conflict";
      return true;
    }
    return false;
  }

  private commit(next: PaidFunnelGraph): void {
    this.past.push(this.graph);
    this.future = [];
    this.graph = next;
    this.markDirty();
  }

  private markDirty(): void {
    this.saveStatus = "dirty";
    this.graph = { ...this.graph, version: this.graph.version + 1 };
  }
}
