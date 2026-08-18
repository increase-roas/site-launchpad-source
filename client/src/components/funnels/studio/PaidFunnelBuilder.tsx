import { Button } from "@/components/ui/button";
import type { ClientIntegrationProfileDto } from "@shared/clientIntegrationProfile";
import type { GenericPaidFunnelPublishStatusView } from "@shared/genericPaidFunnelPublish";
import { renderFunnelCanvas, type CanvasBox } from "@shared/paidFunnel/canvas";
import { breadcrumbFor, type PaletteItem } from "@shared/paidFunnel/ops";
import { PAID_ADS_SECTION_PRESET_LABELS } from "@shared/paidFunnel/presets";
import {
  PAID_FUNNEL_ELEMENT_TYPES,
  type PaidFunnelBreakpoint,
  type PaidFunnelElementType,
  type PaidFunnelSectionPreset,
} from "@shared/paidFunnel/graph";
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
  addStudioSurveyQuestion,
  applyStudioOptInTemplate,
  canDeleteStudioSurveyQuestion,
  canRedoStudio,
  canUndoStudio,
  deleteStudioSurveyQuestion,
  insertPaletteOnCanvas,
  insertStudioItem,
  moveCurrentStudioNode,
  reorderStudioStep,
  selectStudioNode,
  setStudioDevice,
  setStudioStep,
  setStudioZoom,
  studioHotkey,
  type StudioState,
} from "@shared/paidFunnel/store";
import {
  OPT_IN_TEMPLATE_LABELS,
  OPT_IN_TEMPLATE_VALUES,
} from "@shared/paidFunnel/templates";
import { PaidFunnelInspector } from "./PaidFunnelInspector";
import {
  ArrowLeft,
  CheckCircle2,
  ContactRound,
  ExternalLink,
  FileText,
  GripVertical,
  LayoutTemplate,
  ListChecks,
  Loader2,
  Monitor,
  Plus,
  Redo2,
  RefreshCw,
  Rocket,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";

const SECTION_PRESETS = Object.keys(
  PAID_ADS_SECTION_PRESET_LABELS
) as PaidFunnelSectionPreset[];
const ROW_VARIANTS = [1, 2, 3] as const;
const PALETTE_DRAG = "application/x-paid-funnel-palette";

function childDropIndex(
  current: HTMLElement,
  pointer: { x: number; y: number },
  parentKind: CanvasBox["kind"]
): number {
  const kids = Array.from(
    current.querySelectorAll(":scope > [data-canvas-child='true']")
  ) as HTMLElement[];
  return dropIndexFromChildRects(
    kids.map(child => child.getBoundingClientRect()),
    pointer,
    parentKind === "row" ? "horizontal" : "vertical"
  );
}

function ElementCanvasContent({ box }: { box: CanvasBox }) {
  const props = box.props ?? {};
  if (box.elementType === "image") {
    const src = String(props.src ?? "").trim();
    return src ? (
      <img
        src={src}
        alt={String(props.alt ?? "")}
        className="block h-auto w-full rounded-[inherit] object-contain"
      />
    ) : (
      <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-100 px-4 text-sm font-bold text-slate-500">
        Upload an image
      </div>
    );
  }
  if (box.elementType === "multipleChoice") {
    const options = Array.isArray(props.options)
      ? props.options.map(String)
      : [];
    const columns = Math.max(
      1,
      Math.min(4, Math.floor(Number(props.columns) || 1))
    );
    return (
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: Math.max(0, Number(props.gap) || 12),
        }}
      >
        <p className="col-span-full m-0 mb-1 text-inherit">
          {String(props.question ?? "Choose an option")}
        </p>
        {options.map(option => (
          <div
            key={option}
            className="flex min-h-12 items-center justify-center border border-black/10 px-4 py-3 text-center font-bold"
            style={{
              background:
                String(props.buttonBackground ?? "") ||
                "var(--surface, #f8fafc)",
              color: String(props.buttonColor ?? "") || "inherit",
              borderRadius: Math.max(0, Number(props.buttonRadius) || 0),
            }}
          >
            {option}
          </div>
        ))}
      </div>
    );
  }
  if (box.elementType === "form" || box.elementType === "shortAnswer") {
    const fields =
      box.elementType === "form" && Array.isArray(props.fields)
        ? props.fields
            .filter(field => field !== "consent")
            .slice(0, 4)
            .map(String)
        : [String(props.placeholder ?? "Type your answer")];
    return (
      <div className="grid w-full gap-2">
        {box.elementType === "shortAnswer" ? (
          <p className="m-0">{String(props.question ?? "Your answer")}</p>
        ) : null}
        {fields.map(field => (
          <div
            key={field}
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-400"
          >
            {field}
          </div>
        ))}
        <div className="rounded-md bg-blue-600 px-4 py-3 text-center font-bold text-white">
          {String(props.submitLabel ?? "Continue")}
        </div>
      </div>
    );
  }
  if (box.elementType === "list") {
    const items = Array.isArray(props.items) ? props.items.map(String) : [];
    return (
      <ul className="m-0 space-y-1 pl-5 text-left">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (box.elementType === "faq") {
    const items = Array.isArray(props.items)
      ? (props.items as Array<{ question?: unknown; answer?: unknown }>)
      : [];
    return (
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-md border border-current/15 px-3 py-2 text-left"
          >
            <strong>{String(item.question ?? "Question")}</strong>
            <p className="m-0 mt-1 text-sm opacity-75">
              {String(item.answer ?? "Answer")}
            </p>
          </div>
        ))}
      </div>
    );
  }
  if (box.elementType === "testimonial") {
    return (
      <blockquote className="m-0">
        <p className="m-0">“{String(props.quote ?? "Customer quote")}”</p>
        <footer className="mt-2 text-sm opacity-70">
          {String(props.author ?? "Customer")}
        </footer>
      </blockquote>
    );
  }
  if (box.elementType === "spacer")
    return (
      <div
        style={{
          height: Math.max(0, Math.min(600, Number(props.height) || 24)),
        }}
      />
    );
  if (box.elementType === "divider")
    return <hr className="w-full border-current/20" />;
  if (box.elementType === "video")
    return (
      <div className="grid min-h-40 place-items-center rounded-lg bg-slate-900 text-white">
        Video
      </div>
    );
  if (box.elementType === "map")
    return (
      <div className="grid min-h-32 place-items-center rounded-lg bg-slate-200 text-slate-600">
        Map · {String(props.address ?? "Add address")}
      </div>
    );
  if (box.elementType === "inventory")
    return <div>{String(props.heading ?? "Available options")}</div>;
  if (box.elementType === "countdown")
    return (
      <div className="flex justify-between gap-4">
        <span>{String(props.label ?? "Offer ends")}</span>
        <strong>00:00:00</strong>
      </div>
    );
  if (box.elementType === "icon") return <div className="text-3xl">✦</div>;
  if (box.elementType === "html")
    return (
      <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500">
        Custom HTML block
      </div>
    );
  return box.text ? (
    <div className="whitespace-pre-wrap">{box.text}</div>
  ) : null;
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
  onDropIndex: (
    parentId: string,
    parentKind: CanvasBox["kind"],
    index: number,
    item: PaletteItem
  ) => void;
  onMoveNode: (
    id: string,
    parentId: string,
    parentKind: CanvasBox["kind"],
    index: number
  ) => void;
  onNodePointerDown: (
    event: ReactPointerEvent,
    id: string,
    kind: CanvasBox["kind"]
  ) => void;
}) {
  const flags = canvasDragEventFlags(
    { parentId: box.id, parentKind: box.kind, index: 0 },
    active
  );
  const compatible = compatibleTargetKinds(active).includes(
    box.kind as "page" | "section" | "row" | "column"
  );
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
        const index = childDropIndex(
          event.currentTarget,
          { x: event.clientX, y: event.clientY },
          box.kind
        );
        const next = canvasDragEventFlags(
          { parentId: box.id, parentKind: box.kind, index },
          active
        );
        if (!next.accepted) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect =
          active && "type" in active && active.type === "node"
            ? "move"
            : "copy";
        onHover({ id: box.id, index });
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          onHover(null);
      }}
      onDrop={event => {
        const index = childDropIndex(
          event.currentTarget,
          { x: event.clientX, y: event.clientY },
          box.kind
        );
        const next = canvasDragEventFlags(
          { parentId: box.id, parentKind: box.kind, index },
          active
        );
        if (!next.accepted) return;
        event.preventDefault();
        event.stopPropagation();
        if (active && "type" in active && active.type === "node") {
          onMoveNode(active.id, box.id, box.kind, index);
        } else {
          const item =
            parsePalettePayload(event.dataTransfer.getData(PALETTE_DRAG)) ??
            (active && "source" in active ? active : null);
          if (item) onDropIndex(box.id, box.kind, index, item);
        }
        onHover(null);
      }}
      style={{
        ...box.style,
        outline: box.selected
          ? "2px solid #1463f3"
          : compatible
            ? "2px dashed rgba(20,99,243,0.55)"
            : box.kind === "element"
              ? "1px dashed rgba(100,116,139,0.3)"
              : "1px dashed rgba(148,163,184,0.35)",
        opacity: box.visible ? 1 : 0.35,
        display:
          box.kind === "row"
            ? "flex"
            : typeof box.style.display === "string"
              ? box.style.display
              : undefined,
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
          className="absolute right-1 top-1 z-10 grid h-6 w-6 cursor-grab touch-none place-items-center rounded border border-slate-200 bg-white text-[10px] font-black text-slate-500 shadow-sm active:cursor-grabbing"
        >
          ⋮⋮
        </button>
      ) : null}
      {box.kind !== "element" ? (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-blue-50 px-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
          {box.label}
        </span>
      ) : null}
      {box.kind === "element" ? (
        <ElementCanvasContent box={box} />
      ) : box.text ? (
        <div className="px-2 py-1">{box.text}</div>
      ) : null}
      {box.children.map((child, index) => (
        <div
          key={child.id}
          data-canvas-child="true"
          className="relative min-w-0"
          style={box.kind === "row" ? { width: child.style.width } : undefined}
        >
          {flags.accepted && insertAt === index ? (
            <div
              className="h-1 rounded-full bg-cyan-400"
              data-insert-indicator="true"
            />
          ) : null}
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
      {flags.accepted && insertAt === box.children.length ? (
        <div
          className="h-1 rounded-full bg-cyan-400"
          data-insert-indicator="true"
        />
      ) : null}
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
  publish,
  publishPending,
  onPublish,
  onRetryPublish,
}: {
  clientId: number;
  profile: ClientIntegrationProfileDto;
  state: StudioState;
  onChange: Dispatch<SetStateAction<StudioState | null>>;
  onBack: () => void;
  onResolveConflict: () => void;
  publish: GenericPaidFunnelPublishStatusView | null | undefined;
  publishPending: boolean;
  onPublish: () => void;
  onRetryPublish: () => void;
}) {
  const [paletteTab, setPaletteTab] = useState<"section" | "row" | "element">(
    "section"
  );
  const [hover, setHover] = useState<{ id: string; index: number } | null>(
    null
  );
  const [active, setActive] = useState<ActiveDrag | PaletteItem | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draggedStep, setDraggedStep] = useState<number | null>(null);
  const graph = state.document.graph;
  const stateRef = useRef(state);
  stateRef.current = state;
  const page = graph.pages[state.stepKey];
  const saveLabel = state.document.conflict
    ? "error"
    : state.document.saveStatus;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input,textarea,select,button,a,[contenteditable='true']"
        )
      )
        return;
      const next = studioHotkey(
        state,
        event.key.length === 1 ? event.key.toLowerCase() : event.key,
        {
          meta: event.metaKey || event.ctrlKey,
          shift: event.shiftKey,
        }
      );
      if (next !== state) {
        event.preventDefault();
        onChange(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onChange]);

  const canvas = useMemo(
    () =>
      renderFunnelCanvas(graph, {
        stepKey: state.stepKey,
        breakpoint: state.device,
        selectedId: state.selectedId,
      }),
    [graph, state.stepKey, state.device, state.selectedId]
  );
  const crumbs = state.selectedId ? breadcrumbFor(graph, state.selectedId) : [];

  const drop = (
    parentId: string,
    parentKind: CanvasBox["kind"],
    index: number,
    item: PaletteItem
  ) => {
    const kind =
      parentKind === "page"
        ? "page"
        : parentKind === "section"
          ? "section"
          : parentKind === "column"
            ? "column"
            : parentKind === "row"
              ? "row"
              : null;
    if (!kind) return;
    onChange(current =>
      current
        ? insertStudioItem(current, item, { parentId, parentKind: kind, index })
        : current
    );
  };

  const move = (
    id: string,
    parentId: string,
    parentKind: CanvasBox["kind"],
    index: number
  ) => {
    const kind =
      parentKind === "page"
        ? "page"
        : parentKind === "section"
          ? "section"
          : parentKind === "column"
            ? "column"
            : parentKind === "row"
              ? "row"
              : null;
    if (!kind) return;
    onChange(current =>
      moveCurrentStudioNode(current, id, { parentId, parentKind: kind, index })
    );
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
          const parentKind = target.dataset.nodeKind as
            | CanvasBox["kind"]
            | undefined;
          if (
            parentId &&
            parentKind &&
            parentId !== movingId &&
            parentKind !== "element"
          ) {
            const index = childDropIndex(target, { x, y }, parentKind);
            const kind = parentKind as "page" | "section" | "row" | "column";
            const dropTarget = { parentId, parentKind: kind, index };
            if (
              canMoveNodeTo(
                stateRef.current.document.graph,
                movingId,
                dropTarget
              )
            )
              return dropTarget;
          }
        }
        target = target.parentElement?.closest(
          "[data-node-id]"
        ) as HTMLElement | null;
      }
    }
    return null;
  };

  const onNodePointerDown = (
    event: ReactPointerEvent,
    id: string,
    kind: CanvasBox["kind"]
  ) => {
    if (event.button !== 0) return;
    if (kind === "page") return;
    const nodeKind =
      kind === "section" ||
      kind === "row" ||
      kind === "column" ||
      kind === "element"
        ? kind
        : null;
    if (!nodeKind) return;
    event.stopPropagation();
    onChange(current => (current ? selectStudioNode(current, id) : current));
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
      if (handle.hasPointerCapture?.(pointerId))
        handle.releasePointerCapture(pointerId);
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (
        !dragging &&
        !pointerDragStarted(
          startX,
          startY,
          moveEvent.clientX,
          moveEvent.clientY
        )
      )
        return;
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
      className={`grid h-9 w-9 place-items-center rounded-lg ${state.device === device ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
      aria-label={device}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex min-h-[78vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-10 rounded-lg border-slate-200 font-extrabold"
          >
            <ArrowLeft className="h-4 w-4" />
            Funnels
          </Button>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
              Astro funnel builder
            </p>
            <h2 className="text-lg font-extrabold">{graph.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
            Astro output
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            {saveLabel === "saving"
              ? "Saving"
              : saveLabel === "saved"
                ? "Saved"
                : "Error"}
          </span>
          {publish?.repositoryUrl ? (
            <a
              href={publish.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700"
            >
              Repository <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {publish?.liveUrl ? (
            <a
              href={publish.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700"
            >
              Live funnel <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!canUndoStudio(state)}
            onClick={() => onChange(studioHotkey(state, "z", { meta: true }))}
            className="h-9 rounded-lg"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canRedoStudio(state)}
            onClick={() =>
              onChange(studioHotkey(state, "z", { meta: true, shift: true }))
            }
            className="h-9 rounded-lg"
            aria-label="Redo"
          >
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
              onChange({
                ...state,
                document: {
                  ...state.document,
                  saveStatus: "saving",
                  editSeq: state.document.editSeq + 1,
                },
              });
            }}
            className="h-9 rounded-lg bg-blue-600 font-extrabold text-white hover:bg-blue-700"
          >
            {state.document.conflict ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {state.document.conflict ? "Reload latest" : "Save"}
          </Button>
          {publish?.status === "failed" ? (
            <Button
              type="button"
              disabled={publishPending}
              onClick={onRetryPublish}
              className="h-9 rounded-lg bg-amber-500 font-extrabold text-white hover:bg-amber-600"
            >
              {publishPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry publish
            </Button>
          ) : publish?.status === "pending" || publish?.status === "running" ? (
            <Button
              type="button"
              disabled
              className="h-9 rounded-lg bg-blue-600 font-extrabold text-white"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Publishing
            </Button>
          ) : (
            <Button
              type="button"
              disabled={
                publishPending ||
                state.document.saveStatus !== "saved" ||
                state.document.conflict
              }
              onClick={onPublish}
              className="h-9 rounded-lg bg-blue-600 font-extrabold text-white hover:bg-blue-700"
            >
              {publishPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {publish?.status === "published" ? "Republish" : "Publish"}
            </Button>
          )}
        </div>
      </header>

      {publish ? (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            <span>
              {publish.status === "published"
                ? "Published"
                : publish.status === "failed"
                  ? (publish.error ?? "Publish failed.")
                  : `Publishing: ${publish.step.replaceAll("_", " ")}`}
            </span>
            <span>
              {publish.progress.completed}/{publish.progress.total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${publish.status === "failed" ? "bg-amber-500" : "bg-blue-600"}`}
              style={{
                width: `${Math.round((publish.progress.completed / Math.max(1, publish.progress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50/70">
          <div className="border-b border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-700">
                Funnel pages
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="space-y-1">
              {graph.steps.map((step, index) => {
                const Icon =
                  step.type === "survey"
                    ? ListChecks
                    : step.type === "form"
                      ? ContactRound
                      : step.type === "thankYou"
                        ? CheckCircle2
                        : FileText;
                return (
                  <button
                    key={step.key}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedStep(index)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => {
                      if (draggedStep !== null) {
                        onChange(current =>
                          current
                            ? reorderStudioStep(current, draggedStep, index)
                            : current
                        );
                      }
                      setDraggedStep(null);
                    }}
                    onDragEnd={() => setDraggedStep(null)}
                    onClick={() => onChange(setStudioStep(state, step.key))}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${state.stepKey === step.key ? "border-blue-200 bg-blue-50 text-blue-700" : "border-transparent bg-white text-slate-600 hover:border-slate-200"}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold">
                        {index + 1}. {step.title}
                      </span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {step.slug}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full border-dashed border-blue-300 bg-white text-blue-700"
              onClick={() => onChange(addStudioSurveyQuestion(state))}
            >
              <Plus className="h-4 w-4" /> Add survey question
            </Button>
            {canDeleteStudioSurveyQuestion(state) ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full border-red-200 bg-white text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this custom survey question and reconnect its incoming routes?"
                    )
                  )
                    return;
                  onChange(current =>
                    current ? deleteStudioSurveyQuestion(current) : current
                  );
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete survey question
              </Button>
            ) : null}
            {graph.steps.find(step => step.type === "landing")?.key ===
            state.stepKey ? (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => setShowTemplates(value => !value)}
                >
                  <LayoutTemplate className="h-4 w-4" /> Change opt-in template
                </Button>
                {showTemplates ? (
                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
                    {OPT_IN_TEMPLATE_VALUES.map(template => (
                      <button
                        key={template}
                        type="button"
                        className="w-full rounded-md px-2 py-2 text-left text-xs font-bold hover:bg-blue-50"
                        onClick={() => {
                          onChange(applyStudioOptInTemplate(state, template));
                          setShowTemplates(false);
                        }}
                      >
                        {OPT_IN_TEMPLATE_LABELS[template]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex border-b border-slate-200">
            {(["section", "row", "element"] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPaletteTab(tab)}
                className={`h-11 flex-1 text-xs font-extrabold uppercase tracking-wider ${
                  paletteTab === tab
                    ? "border-b-2 border-blue-600 bg-white text-blue-700"
                    : "text-slate-500"
                }`}
              >
                {tab === "section"
                  ? "Sections"
                  : tab === "row"
                    ? "Rows"
                    : "Elements"}
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
                        event.dataTransfer.setData(
                          PALETTE_DRAG,
                          startPalette(item)
                        );
                      }}
                      onDragEnd={() => setActive(null)}
                      onClick={() =>
                        onChange(insertPaletteOnCanvas(state, item))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 hover:border-blue-300"
                    >
                      {PAID_ADS_SECTION_PRESET_LABELS[preset]}
                    </button>
                  );
                })
              : null}
            {paletteTab === "section" && graph.reusableSections.length
              ? graph.reusableSections.map(entry => {
                  const item: PaletteItem = {
                    source: "reusable",
                    reusableId: entry.id,
                  };
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event =>
                        event.dataTransfer.setData(
                          PALETTE_DRAG,
                          startPalette(item)
                        )
                      }
                      onDragEnd={() => setActive(null)}
                      onClick={() =>
                        onChange(insertPaletteOnCanvas(state, item))
                      }
                      className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-left text-sm font-bold text-blue-700"
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
                      onDragStart={event =>
                        event.dataTransfer.setData(
                          PALETTE_DRAG,
                          startPalette(item)
                        )
                      }
                      onDragEnd={() => setActive(null)}
                      onClick={() =>
                        onChange(insertPaletteOnCanvas(state, item))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 hover:border-blue-300"
                    >
                      {columns}-column row
                    </button>
                  );
                })
              : null}
            {paletteTab === "element"
              ? (
                  PAID_FUNNEL_ELEMENT_TYPES as unknown as PaidFunnelElementType[]
                ).map(type => {
                  const item: PaletteItem = { source: "element", type };
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      aria-label={paletteItemLabel(item)}
                      onDragStart={event =>
                        event.dataTransfer.setData(
                          PALETTE_DRAG,
                          startPalette(item)
                        )
                      }
                      onDragEnd={() => setActive(null)}
                      onClick={() =>
                        onChange(insertPaletteOnCanvas(state, item))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold capitalize text-slate-700 hover:border-blue-300"
                    >
                      {type}
                    </button>
                  );
                })
              : null}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
            <p className="truncate text-xs font-bold text-muted-foreground">
              {crumbs.length
                ? crumbs.map(crumb => (
                    <button
                      key={crumb.id}
                      type="button"
                      className="mr-1 hover:text-blue-600"
                      onClick={() =>
                        onChange(selectStudioNode(state, crumb.id))
                      }
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
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground"
                aria-label="Zoom out"
                onClick={() => onChange(setStudioZoom(state, state.zoom - 0.1))}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs font-extrabold">
                {Math.round(state.zoom * 100)}%
              </span>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground"
                aria-label="Zoom in"
                onClick={() => onChange(setStudioZoom(state, state.zoom + 0.1))}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-100 p-6">
            <div
              style={{
                zoom: state.zoom,
                width:
                  state.device === "mobile"
                    ? 390
                    : state.device === "tablet"
                      ? 768
                      : 1120,
                margin: "0 auto",
              }}
              className="min-h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40"
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
                <div className="grid min-h-[640px] place-items-center text-sm font-bold text-muted-foreground">
                  This step has no page graph.
                </div>
              )}
            </div>
          </div>
        </section>

        <PaidFunnelInspector
          clientId={clientId}
          state={state}
          onChange={onChange}
          profile={profile}
        />
      </div>
      {page ? <p className="sr-only">Editing {page.stepKey}</p> : null}
    </div>
  );
}
