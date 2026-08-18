import { Button } from "@/components/ui/button";
import type { ClientIntegrationProfileDto } from "@shared/clientIntegrationProfile";
import { renderFunnelCanvas, type CanvasBox } from "@shared/paidFunnel/canvas";
import { breadcrumbFor, type PaletteItem } from "@shared/paidFunnel/ops";
import { PAID_ADS_SECTION_PRESET_LABELS } from "@shared/paidFunnel/presets";
import { PAID_FUNNEL_ELEMENT_TYPES, type PaidFunnelBreakpoint, type PaidFunnelElementType, type PaidFunnelSectionPreset } from "@shared/paidFunnel/graph";
import {
  canvasDragEventFlags,
  canvasNodeLabel,
  canMoveNodeTo,
  compatibleTargetKinds,
  dropIndexFromChildRects,
  paletteItemLabel,
  parsePalettePayload,
  pointerDragStarted,
  type ActiveDrag,
} from "@shared/paidFunnel/dropRouting";
import {
  canRedoStudio,
  canUndoStudio,
  insertPaletteOnCanvas,
  insertStudioItem,
  moveStudioNode,
  selectStudioNode,
  setStudioDevice,
  setStudioStep,
  setStudioZoom,
  studioHotkey,
  type StudioState,
} from "@shared/paidFunnel/store";
import { PaidFunnelInspector } from "./PaidFunnelInspector";
import { ArrowLeft, Monitor, Redo2, RefreshCw, Save, Smartphone, Tablet, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";

const SECTION_PRESETS = Object.keys(PAID_ADS_SECTION_PRESET_LABELS) as PaidFunnelSectionPreset[];
const ROW_VARIANTS = [1, 2, 3] as const;
const PALETTE_DRAG = "application/x-paid-funnel-palette";

function childDropIndex(current: HTMLElement, pointer: { x: number; y: number }, parentKind: CanvasBox["kind"]): number {
  const kids = Array.from(current.querySelectorAll(":scope > [data-canvas-child='true']")) as HTMLElement[];
  return dropIndexFromChildRects(
    kids.map(child => child.getBoundingClientRect()),
    pointer,
    parentKind === "row" ? "horizontal" : "vertical",
  );
}

function CanvasPreview({
  box,
  hover,
  active,
  onSelect,
  onHover,
  onDropIndex,
  onMoveNode,
  onNodePointerDown,
}: {
  box: CanvasBox;
  hover: { id: string; index: number } | null;
  active: ActiveDrag | PaletteItem | null;
  onSelect: (id: string) => void;
  onHover: (next: { id: string; index: number } | null) => void;
  onDropIndex: (parentId: string, parentKind: CanvasBox["kind"], index: number, item: PaletteItem) => void;
  onMoveNode: (id: string, parentId: string, parentKind: CanvasBox["kind"], index: number) => void;
  onNodePointerDown: (event: ReactPointerEvent, id: string, kind: CanvasBox["kind"]) => void;
}) {
  const flags = canvasDragEventFlags({ parentId: box.id, parentKind: box.kind, index: 0 }, active);
  const compatible = compatibleTargetKinds(active).includes(box.kind as "page" | "section" | "row" | "column");
  const insertAt = hover?.id === box.id ? hover.index : null;
  const name = canvasNodeLabel(box.kind, box.label || box.text || box.id);
  return (
    <div
      role="group"
      aria-label={name}
      data-node-id={box.id}
      data-node-kind={box.kind}
      data-drop-accepted={flags.accepted ? "true" : "false"}
      tabIndex={0}
      onClick={event => {
        event.stopPropagation();
        onSelect(box.id);
      }}
      onFocus={() => onSelect(box.id)}
      onDragOver={event => {
        const index = childDropIndex(event.currentTarget, { x: event.clientX, y: event.clientY }, box.kind);
        const next = canvasDragEventFlags({ parentId: box.id, parentKind: box.kind, index }, active);
        if (!next.accepted) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = active && "type" in active && active.type === "node" ? "move" : "copy";
        onHover({ id: box.id, index });
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onHover(null);
      }}
      onDrop={event => {
        const index = childDropIndex(event.currentTarget, { x: event.clientX, y: event.clientY }, box.kind);
        const next = canvasDragEventFlags({ parentId: box.id, parentKind: box.kind, index }, active);
        if (!next.accepted) return;
        event.preventDefault();
        event.stopPropagation();
        if (active && "type" in active && active.type === "node") {
          onMoveNode(active.id, box.id, box.kind, index);
        } else {
          const item = parsePalettePayload(event.dataTransfer.getData(PALETTE_DRAG)) ?? (active && "source" in active ? active : null);
          if (item) onDropIndex(box.id, box.kind, index, item);
        }
        onHover(null);
      }}
      style={{
        ...box.style,
        outline: box.selected
          ? "2px solid #22d3ee"
          : compatible
            ? "2px dashed rgba(34,211,238,0.55)"
            : box.kind === "element"
              ? "1px dashed rgba(255,255,255,0.08)"
              : "1px dashed rgba(255,255,255,0.04)",
        opacity: box.visible ? 1 : 0.35,
        display: box.kind === "row" ? "flex" : typeof box.style.display === "string" ? box.style.display : undefined,
        cursor: "default",
        touchAction: "auto",
      }}
      className="relative min-h-8"
    >
      {box.kind !== "page" ? (
        <button
          type="button"
          aria-label={`Drag ${name}`}
          data-drag-handle="true"
          onPointerDown={event => onNodePointerDown(event, box.id, box.kind)}
          className="absolute right-1 top-1 z-10 grid h-6 w-6 cursor-grab touch-none place-items-center rounded bg-slate-950/70 text-[10px] font-black text-cyan-200 active:cursor-grabbing"
        >
          ⋮⋮
        </button>
      ) : null}
      {box.kind !== "element" ? (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-200">
          {box.label}
        </span>
      ) : null}
      {box.text ? <div className="px-2 py-1">{box.text}</div> : null}
      {box.children.map((child, index) => (
        <div key={child.id} data-canvas-child="true" className="relative min-w-0" style={box.kind === "row" ? { width: child.style.width } : undefined}>
          {flags.accepted && insertAt === index ? <div className="h-1 rounded-full bg-cyan-400" data-insert-indicator="true" /> : null}
          <CanvasPreview
            box={child}
            hover={hover}
            active={active}
            onSelect={onSelect}
            onHover={onHover}
            onDropIndex={onDropIndex}
            onMoveNode={onMoveNode}
            onNodePointerDown={onNodePointerDown}
          />
        </div>
      ))}
      {flags.accepted && insertAt === box.children.length ? <div className="h-1 rounded-full bg-cyan-400" data-insert-indicator="true" /> : null}
    </div>
  );
}

export function PaidFunnelBuilder({
  clientId,
  profile,
  state,
  onChange,
  onBack,
  onResolveConflict,
}: {
  clientId: number;
  profile: ClientIntegrationProfileDto;
  state: StudioState;
  onChange: Dispatch<SetStateAction<StudioState | null>>;
  onBack: () => void;
  onResolveConflict: () => void;
}) {
  const [paletteTab, setPaletteTab] = useState<"section" | "row" | "element">("section");
  const [hover, setHover] = useState<{ id: string; index: number } | null>(null);
  const [active, setActive] = useState<ActiveDrag | PaletteItem | null>(null);
  const graph = state.document.graph;
  const page = graph.pages[state.stepKey];
  const saveLabel = state.document.conflict ? "error" : state.document.saveStatus;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,button,a,[contenteditable='true']")) return;
      const next = studioHotkey(state, event.key.length === 1 ? event.key.toLowerCase() : event.key, {
        meta: event.metaKey || event.ctrlKey,
        shift: event.shiftKey,
      });
      if (next !== state) {
        event.preventDefault();
        onChange(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onChange]);

  const canvas = useMemo(
    () => renderFunnelCanvas(graph, { stepKey: state.stepKey, breakpoint: state.device, selectedId: state.selectedId }),
    [graph, state.stepKey, state.device, state.selectedId],
  );
  const crumbs = state.selectedId ? breadcrumbFor(graph, state.selectedId) : [];

  const drop = (parentId: string, parentKind: CanvasBox["kind"], index: number, item: PaletteItem) => {
    const kind = parentKind === "page" ? "page" : parentKind === "section" ? "section" : parentKind === "column" ? "column" : parentKind === "row" ? "row" : null;
    if (!kind) return;
    onChange(insertStudioItem(state, item, { parentId, parentKind: kind, index }));
  };

  const move = (id: string, parentId: string, parentKind: CanvasBox["kind"], index: number) => {
    const kind = parentKind === "page" ? "page" : parentKind === "section" ? "section" : parentKind === "column" ? "column" : parentKind === "row" ? "row" : null;
    if (!kind) return;
    onChange(moveStudioNode(state, id, { parentId, parentKind: kind, index }));
  };

  const startPalette = (item: PaletteItem) => {
    setActive(item);
    return JSON.stringify(item);
  };

  const pointerTarget = (x: number, y: number, movingId: string) => {
    const seen = new Set<HTMLElement>();
    for (const hit of document.elementsFromPoint(x, y)) {
      let target = hit.closest("[data-node-id]") as HTMLElement | null;
      while (target) {
        if (!seen.has(target)) {
          seen.add(target);
          const parentId = target.dataset.nodeId;
          const parentKind = target.dataset.nodeKind as CanvasBox["kind"] | undefined;
          if (parentId && parentKind && parentId !== movingId && parentKind !== "element") {
            const index = childDropIndex(target, { x, y }, parentKind);
            const kind = parentKind as "page" | "section" | "row" | "column";
            const dropTarget = { parentId, parentKind: kind, index };
            if (canMoveNodeTo(graph, movingId, dropTarget)) return dropTarget;
          }
        }
        target = target.parentElement?.closest("[data-node-id]") as HTMLElement | null;
      }
    }
    return null;
  };

  const onNodePointerDown = (event: ReactPointerEvent, id: string, kind: CanvasBox["kind"]) => {
    if (event.button !== 0) return;
    if (kind === "page") return;
    const nodeKind = kind === "section" || kind === "row" || kind === "column" || kind === "element" ? kind : null;
    if (!nodeKind) return;
    event.stopPropagation();
    onChange(selectStudioNode(state, id));
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(pointerId);
    let dragging = false;
    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      setActive(null);
      setHover(null);
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!dragging && !pointerDragStarted(startX, startY, moveEvent.clientX, moveEvent.clientY)) return;
      if (!dragging) {
        dragging = true;
        setActive({ type: "node", id, nodeKind });
      }
      moveEvent.preventDefault();
      const target = pointerTarget(moveEvent.clientX, moveEvent.clientY, id);
      setHover(target ? { id: target.parentId, index: target.index } : null);
    };
    const handleUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return;
      if (dragging) {
        const target = pointerTarget(up.clientX, up.clientY, id);
        if (target) move(id, target.parentId, target.parentKind, target.index);
      }
      cleanup();
    };
    const handleCancel = (cancel: PointerEvent) => {
      if (cancel.pointerId !== pointerId) return;
      cleanup();
    };
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  };

  const deviceBtn = (device: PaidFunnelBreakpoint, Icon: typeof Monitor) => (
    <button
      type="button"
      onClick={() => onChange(setStudioDevice(state, device))}
      className={`grid h-9 w-9 place-items-center rounded-lg ${state.device === device ? "bg-cyan-400 text-slate-950" : "text-muted-foreground hover:bg-white/5"}`}
      aria-label={device}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex min-h-[78vh] flex-col overflow-hidden rounded-3xl border border-white/8 bg-[#071018]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="h-10 rounded-xl border-white/10 font-extrabold">
            <ArrowLeft className="h-4 w-4" />
            Funnels
          </Button>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Paid Ads builder</p>
            <h2 className="text-lg font-extrabold">{graph.name}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {graph.steps.map(step => (
            <button
              key={step.key}
              type="button"
              onClick={() => onChange(setStudioStep(state, step.key))}
              className={`h-9 rounded-lg px-3 text-xs font-extrabold ${
                state.stepKey === step.key ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-muted-foreground"
              }`}
            >
              {step.title}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            {saveLabel === "saving" ? "Saving" : saveLabel === "saved" ? "Saved" : "Error"}
          </span>
          <Button type="button" variant="outline" disabled={!canUndoStudio(state)} onClick={() => onChange(studioHotkey(state, "z", { meta: true }))} className="h-9 rounded-lg" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" disabled={!canRedoStudio(state)} onClick={() => onChange(studioHotkey(state, "z", { meta: true, shift: true }))} className="h-9 rounded-lg" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (state.document.conflict) {
                onResolveConflict();
                return;
              }
              if (state.document.saveStatus === "saved") return;
              onChange({ ...state, document: { ...state.document, saveStatus: "saving", editSeq: state.document.editSeq + 1 } });
            }}
            className="h-9 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            {state.document.conflict ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {state.document.conflict ? "Reload latest" : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="border-r border-white/8">
          <div className="flex border-b border-white/8">
            {(["section", "row", "element"] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPaletteTab(tab)}
                className={`h-11 flex-1 text-xs font-extrabold uppercase tracking-wider ${
                  paletteTab === tab ? "bg-cyan-400/15 text-cyan-200" : "text-muted-foreground"
                }`}
              >
                {tab === "section" ? "Sections" : tab === "row" ? "Rows" : "Elements"}
              </button>
            ))}
          </div>
          <div className="space-y-2 overflow-y-auto p-3">
            {paletteTab === "section"
              ? SECTION_PRESETS.map(preset => {
                  const item: PaletteItem = { source: "section", preset };
                  return (
                    <button
                      key={preset}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event => {
                        event.dataTransfer.setData(PALETTE_DRAG, startPalette(item));
                      }}
                      onDragEnd={() => setActive(null)}
                      onClick={() => onChange(insertPaletteOnCanvas(state, item))}
                      className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold hover:border-cyan-300/30"
                    >
                      {PAID_ADS_SECTION_PRESET_LABELS[preset]}
                    </button>
                  );
                })
              : null}
            {paletteTab === "section" && graph.reusableSections.length
              ? graph.reusableSections.map(entry => {
                  const item: PaletteItem = { source: "reusable", reusableId: entry.id };
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, startPalette(item))}
                      onDragEnd={() => setActive(null)}
                      onClick={() => onChange(insertPaletteOnCanvas(state, item))}
                      className="w-full rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/[0.04] px-3 py-2 text-left text-sm font-bold"
                    >
                      {entry.name}
                    </button>
                  );
                })
              : null}
            {paletteTab === "row"
              ? ROW_VARIANTS.map(columns => {
                  const item: PaletteItem = { source: "row", columns };
                  return (
                    <button
                      key={columns}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, startPalette(item))}
                      onDragEnd={() => setActive(null)}
                      onClick={() => onChange(insertPaletteOnCanvas(state, item))}
                      className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold hover:border-cyan-300/30"
                    >
                      {columns}-column row
                    </button>
                  );
                })
              : null}
            {paletteTab === "element"
              ? (PAID_FUNNEL_ELEMENT_TYPES as unknown as PaidFunnelElementType[]).map(type => {
                  const item: PaletteItem = { source: "element", type };
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, startPalette(item))}
                      onDragEnd={() => setActive(null)}
                      onClick={() => onChange(insertPaletteOnCanvas(state, item))}
                      className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold capitalize hover:border-cyan-300/30"
                    >
                      {type}
                    </button>
                  );
                })
              : null}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2">
            <p className="truncate text-xs font-bold text-muted-foreground">
              {crumbs.length
                ? crumbs.map(crumb => (
                    <button
                      key={crumb.id}
                      type="button"
                      className="mr-1 hover:text-cyan-200"
                      onClick={() => onChange(selectStudioNode(state, crumb.id))}
                    >
                      {crumb.label} /
                    </button>
                  ))
                : "Select a block"}
            </p>
            <div className="flex items-center gap-1">
              {deviceBtn("desktop", Monitor)}
              {deviceBtn("tablet", Tablet)}
              {deviceBtn("mobile", Smartphone)}
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground" aria-label="Zoom out" onClick={() => onChange(setStudioZoom(state, state.zoom - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs font-extrabold">{Math.round(state.zoom * 100)}%</span>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground" aria-label="Zoom in" onClick={() => onChange(setStudioZoom(state, state.zoom + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_40%),#050b12] p-6">
            <div
              style={{
                zoom: state.zoom,
                width: state.device === "mobile" ? 390 : state.device === "tablet" ? 768 : 1120,
                margin: "0 auto",
              }}
              className="min-h-[640px] overflow-hidden rounded-[28px] border border-white/10 bg-[#071018] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            >
              {canvas ? (
                <CanvasPreview
                  box={canvas}
                  hover={hover}
                  active={active}
                  onSelect={id => onChange(selectStudioNode(state, id))}
                  onHover={setHover}
                  onDropIndex={drop}
                  onMoveNode={move}
                  onNodePointerDown={onNodePointerDown}
                />
              ) : (
                <div className="grid min-h-[640px] place-items-center text-sm font-bold text-muted-foreground">This step has no page graph.</div>
              )}
            </div>
          </div>
        </section>

        <PaidFunnelInspector clientId={clientId} state={state} onChange={onChange} profile={profile} />
      </div>
      {page ? <p className="sr-only">Editing {page.stepKey}</p> : null}
    </div>
  );
}
