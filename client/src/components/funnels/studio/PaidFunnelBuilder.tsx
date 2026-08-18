import { Button } from "@/components/ui/button";
import { emptyClientIntegrationPresence } from "@shared/paidFunnel/integrationPresence";
import { renderFunnelCanvas, dropIndexFromPointer, type CanvasBox } from "@shared/paidFunnel/canvas";
import { breadcrumbFor, type PaletteItem } from "@shared/paidFunnel/ops";
import { PAID_ADS_SECTION_PRESET_LABELS } from "@shared/paidFunnel/presets";
import { PAID_FUNNEL_ELEMENT_TYPES, type PaidFunnelBreakpoint, type PaidFunnelElementType, type PaidFunnelSectionPreset } from "@shared/paidFunnel/graph";
import {
  canRedoStudio,
  canUndoStudio,
  insertPaletteOnCanvas,
  insertStudioItem,
  markStudioSaved,
  selectStudioNode,
  setStudioDevice,
  setStudioStep,
  setStudioZoom,
  studioHotkey,
  type StudioState,
} from "@shared/paidFunnel/store";
import { PaidFunnelInspector } from "./PaidFunnelInspector";
import { ArrowLeft, Monitor, Redo2, Save, Smartphone, Tablet, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

const SECTION_PRESETS = Object.keys(PAID_ADS_SECTION_PRESET_LABELS) as PaidFunnelSectionPreset[];
const ROW_VARIANTS = [1, 2, 3] as const;
const PALETTE_DRAG = "application/x-paid-funnel-palette";

function parsePalette(raw: string): PaletteItem | null {
  try {
    return JSON.parse(raw) as PaletteItem;
  } catch {
    return null;
  }
}

function CanvasPreview({
  box,
  hover,
  onSelect,
  onHover,
  onDropIndex,
}: {
  box: CanvasBox;
  hover: { id: string; index: number } | null;
  onSelect: (id: string) => void;
  onHover: (next: { id: string; index: number } | null) => void;
  onDropIndex: (parentId: string, parentKind: CanvasBox["kind"], index: number, item: PaletteItem) => void;
}) {
  const accept = box.kind === "page" || box.kind === "section" || box.kind === "column";
  const insertAt = hover?.id === box.id ? hover.index : null;
  return (
    <div
      data-node-id={box.id}
      data-node-kind={box.kind}
      onClick={event => {
        event.stopPropagation();
        onSelect(box.id);
      }}
      onDragOver={event => {
        if (!accept) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        const rect = event.currentTarget.getBoundingClientRect();
        onHover({ id: box.id, index: dropIndexFromPointer(box.children.length, event.clientY, rect.top, rect.height) });
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onHover(null);
      }}
      onDrop={event => {
        if (!accept) return;
        event.preventDefault();
        event.stopPropagation();
        const item = parsePalette(event.dataTransfer.getData(PALETTE_DRAG));
        const rect = event.currentTarget.getBoundingClientRect();
        const index = dropIndexFromPointer(box.children.length, event.clientY, rect.top, rect.height);
        if (item) onDropIndex(box.id, box.kind, index, item);
        onHover(null);
      }}
      style={{
        ...box.style,
        outline: box.selected ? "2px solid #22d3ee" : box.kind === "element" ? "1px dashed rgba(255,255,255,0.08)" : "1px dashed rgba(255,255,255,0.04)",
        opacity: box.visible ? 1 : 0.35,
        display: box.kind === "row" ? "flex" : box.style.display,
      }}
      className="relative min-h-8"
    >
      {box.kind !== "element" ? (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-200">
          {box.label}
        </span>
      ) : null}
      {box.text ? <div className="px-2 py-1">{box.text}</div> : null}
      {box.children.map((child, index) => (
        <div key={child.id} className="relative min-w-0" style={box.kind === "row" ? { width: child.style.width } : undefined}>
          {accept && insertAt === index ? <div className="h-1 rounded-full bg-cyan-400" data-insert-indicator="true" /> : null}
          <CanvasPreview box={child} hover={hover} onSelect={onSelect} onHover={onHover} onDropIndex={onDropIndex} />
        </div>
      ))}
      {accept && insertAt === box.children.length ? <div className="h-1 rounded-full bg-cyan-400" data-insert-indicator="true" /> : null}
    </div>
  );
}

export function PaidFunnelBuilder({
  clientId,
  state,
  onChange,
  onBack,
}: {
  clientId: number;
  state: StudioState;
  onChange: Dispatch<SetStateAction<StudioState | null>>;
  onBack: () => void;
}) {
  const [paletteTab, setPaletteTab] = useState<"section" | "row" | "element">("section");
  const [hover, setHover] = useState<{ id: string; index: number } | null>(null);
  const profile = emptyClientIntegrationPresence(clientId);
  const graph = state.document.graph;
  const page = graph.pages[state.stepKey];
  const saveLabel = state.document.conflict ? "error" : state.document.saveStatus;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
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
    const kind = parentKind === "page" ? "page" : parentKind === "section" ? "section" : parentKind === "column" ? "column" : null;
    if (!kind) return;
    onChange(insertStudioItem(state, item, { parentId, parentKind: kind, index }));
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
          <Button type="button" variant="outline" disabled={!canUndoStudio(state)} onClick={() => onChange(studioHotkey(state, "z", { meta: true }))} className="h-9 rounded-lg">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" disabled={!canRedoStudio(state)} onClick={() => onChange(studioHotkey(state, "z", { meta: true, shift: true }))} className="h-9 rounded-lg">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => onChange(markStudioSaved(state))}
            className="h-9 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            <Save className="h-4 w-4" />
            Save
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
              ? SECTION_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    draggable
                    onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, JSON.stringify({ source: "section", preset }))}
                    onClick={() => onChange(insertPaletteOnCanvas(state, { source: "section", preset }))}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold hover:border-cyan-300/30"
                  >
                    {PAID_ADS_SECTION_PRESET_LABELS[preset]}
                  </button>
                ))
              : null}
            {paletteTab === "section" && graph.reusableSections.length
              ? graph.reusableSections.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    draggable
                    onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, JSON.stringify({ source: "reusable", reusableId: entry.id }))}
                    onClick={() => onChange(insertPaletteOnCanvas(state, { source: "reusable", reusableId: entry.id }))}
                    className="w-full rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/[0.04] px-3 py-2 text-left text-sm font-bold"
                  >
                    {entry.name}
                  </button>
                ))
              : null}
            {paletteTab === "row"
              ? ROW_VARIANTS.map(columns => (
                  <button
                    key={columns}
                    type="button"
                    draggable
                    onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, JSON.stringify({ source: "row", columns }))}
                    onClick={() => onChange(insertPaletteOnCanvas(state, { source: "row", columns }))}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold hover:border-cyan-300/30"
                  >
                    {columns}-column row
                  </button>
                ))
              : null}
            {paletteTab === "element"
              ? (PAID_FUNNEL_ELEMENT_TYPES as unknown as PaidFunnelElementType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={event => event.dataTransfer.setData(PALETTE_DRAG, JSON.stringify({ source: "element", type }))}
                    onClick={() => onChange(insertPaletteOnCanvas(state, { source: "element", type }))}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm font-bold capitalize hover:border-cyan-300/30"
                  >
                    {type}
                  </button>
                ))
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
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground" onClick={() => onChange(setStudioZoom(state, state.zoom - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs font-extrabold">{Math.round(state.zoom * 100)}%</span>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground" onClick={() => onChange(setStudioZoom(state, state.zoom + 0.1))}>
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
                  onSelect={id => onChange(selectStudioNode(state, id))}
                  onHover={setHover}
                  onDropIndex={drop}
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
