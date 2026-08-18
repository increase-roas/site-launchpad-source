import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  SIMPLE_FORM_TEMPLATE_LOGO_URL,
  SIMPLE_FORM_TEMPLATE_PRODUCTS,
  parseServiceAreaZips,
  type SimpleFormImageSource,
  type SimpleFormOperatorConfig,
  type SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import {
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
} from "@shared/simpleFormContract";
import type {
  FunnelPublishStatus,
  FunnelPublishStep,
  SimpleFormPublishStatusView,
} from "@shared/simpleFormPublish";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  GripVertical,
  Loader2,
  MousePointer2,
  Rocket,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PublishStateLike = {
  status: FunnelPublishStatus;
  step: FunnelPublishStep;
};

type VersionedPublishStateLike = PublishStateLike & {
  updatedAt: Date;
};

export type PublishAdvanceControllerState = {
  locked: boolean;
  pausedAfterErrorVersion: number | null;
};

type PublishAdvanceController = {
  cancelScheduled: () => void;
  completeError: () => void;
  completeRequest: () => void;
  dispose: () => void;
  getState: () => PublishAdvanceControllerState;
  observeSuccessfulStatus: (publish: VersionedPublishStateLike) => void;
  resetForStart: () => void;
  retry: (publish: VersionedPublishStateLike, request: () => void) => boolean;
  scheduleAutomatic: (
    publish: VersionedPublishStateLike,
    delay: number,
    request: () => void
  ) => void;
};

const initialPublishAdvanceControllerState: PublishAdvanceControllerState = {
  locked: false,
  pausedAfterErrorVersion: null,
};

function publishVersion(publish: VersionedPublishStateLike): number {
  return publish.updatedAt.getTime();
}

export function isPublishPausedAfterError(
  publish: VersionedPublishStateLike | null,
  pausedAfterErrorVersion: number | null
): boolean {
  return Boolean(
    publish &&
      pausedAfterErrorVersion !== null &&
      publishVersion(publish) <= pausedAfterErrorVersion
  );
}

export function createPublishAdvanceController(
  onStateChange: (state: PublishAdvanceControllerState) => void = () => {}
): PublishAdvanceController {
  let disposed = false;
  let latestSuccessfulVersion: number | null = null;
  let attemptedVersion: number | null = null;
  let state = { ...initialPublishAdvanceControllerState };
  let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

  const notify = () => onStateChange({ ...state });
  const cancelScheduled = () => {
    if (timeout === null) return;
    globalThis.clearTimeout(timeout);
    timeout = null;
  };
  const requestAdvance = (
    publish: VersionedPublishStateLike,
    request: () => void
  ): boolean => {
    if (
      disposed ||
      state.locked ||
      isPublishPausedAfterError(publish, state.pausedAfterErrorVersion)
    ) {
      return false;
    }
    state = { ...state, locked: true };
    attemptedVersion = publishVersion(publish);
    notify();
    request();
    return true;
  };

  return {
    cancelScheduled,
    completeError: () => {
      if (
        disposed ||
        attemptedVersion === null ||
        (latestSuccessfulVersion !== null &&
          latestSuccessfulVersion > attemptedVersion)
      ) {
        return;
      }
      state = {
        ...state,
        pausedAfterErrorVersion: attemptedVersion,
      };
      notify();
    },
    completeRequest: () => {
      if (disposed) return;
      attemptedVersion = null;
      if (!state.locked) return;
      state = { ...state, locked: false };
      notify();
    },
    dispose: () => {
      disposed = true;
      cancelScheduled();
    },
    getState: () => ({ ...state }),
    observeSuccessfulStatus: publish => {
      if (disposed) return;
      const version = publishVersion(publish);
      latestSuccessfulVersion = Math.max(
        latestSuccessfulVersion ?? version,
        version
      );
      if (
        state.pausedAfterErrorVersion === null ||
        version <= state.pausedAfterErrorVersion
      ) {
        return;
      }
      state = { ...state, pausedAfterErrorVersion: null };
      notify();
    },
    resetForStart: () => {
      if (disposed) return;
      cancelScheduled();
      if (state.pausedAfterErrorVersion === null) return;
      state = { ...state, pausedAfterErrorVersion: null };
      notify();
    },
    retry: (publish, request) => {
      if (disposed || state.locked) return false;
      cancelScheduled();
      if (state.pausedAfterErrorVersion !== null) {
        state = { ...state, pausedAfterErrorVersion: null };
        notify();
      }
      return requestAdvance(publish, request);
    },
    scheduleAutomatic: (publish, delay, request) => {
      cancelScheduled();
      if (
        disposed ||
        !shouldAutoAdvancePublish(publish) ||
        state.locked ||
        isPublishPausedAfterError(publish, state.pausedAfterErrorVersion)
      ) {
        return;
      }
      timeout = globalThis.setTimeout(() => {
        timeout = null;
        requestAdvance(publish, request);
      }, delay);
    },
  };
}

export function effectivePublishStatus<T extends VersionedPublishStateLike>(
  ...candidates: Array<T | null | undefined>
): T | null {
  let effective: T | null = null;
  for (const candidate of candidates) {
    if (
      candidate &&
      (!effective || publishVersion(candidate) > publishVersion(effective))
    ) {
      effective = candidate;
    }
  }
  return effective;
}

export function publishAdvanceDelayMs(
  publish: Pick<
    SimpleFormPublishStatusView,
    "status" | "step" | "dispatchRequestedAt"
  >
): number {
  if (publish.status === "running") return 3_000;
  if (
    publish.step === "monitor_workflow" ||
    (publish.step === "dispatch_workflow" && publish.dispatchRequestedAt)
  ) {
    return 2_000;
  }
  return 0;
}

export function publishActionLabel(
  publish: PublishStateLike | null
): "Publish" | "Retry" | null {
  if (!publish) return "Publish";
  if (publish.status === "published") return null;
  return "Retry";
}

export function publishActionForState(
  publish: VersionedPublishStateLike | null,
  pausedAfterErrorVersion: number | null
): "Publish" | "Retry" | null {
  if (isPublishPausedAfterError(publish, pausedAfterErrorVersion)) {
    return "Retry";
  }
  return shouldAutoAdvancePublish(publish) ? null : publishActionLabel(publish);
}

export function shouldAutoAdvancePublish(
  publish: PublishStateLike | null
): boolean {
  return Boolean(
    publish &&
      (publish.status === "pending" || publish.status === "running") &&
      publish.step !== "published"
  );
}

export function publishPollInterval(
  publish: PublishStateLike | null | undefined,
): 3_000 | false {
  return shouldAutoAdvancePublish(publish ?? null) ? 3_000 : false;
}

export function publishProgressPercent(progress: {
  completed: number;
  total: number;
}): number {
  if (progress.total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((progress.completed / progress.total) * 100))
  );
}

export function offlineConversionOperatorGuidance(): {
  allowedCallbackStages: string[];
  stageMappings: string[];
} {
  return {
    allowedCallbackStages:
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.stageMappings.map(
        mapping => mapping.callbackStage
      ),
    stageMappings: SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.stageMappings.map(
      mapping =>
        `${mapping.pipelineStage} → ${mapping.callbackStage} → Meta ${mapping.metaEvent}`
    ),
  };
}

function publishStepLabel(step: FunnelPublishStep): string {
  switch (step) {
    case "create_repository":
      return "Creating repository";
    case "ensure_kv_namespace":
      return "Configuring session storage";
    case "ensure_d1_database":
      return "Configuring funnel database";
    case "ensure_queues":
      return "Configuring retry queues";
    case "commit_source":
      return "Committing generated source";
    case "dispatch_workflow":
      return "Starting deployment workflow";
    case "monitor_workflow":
      return "Monitoring deployment";
    case "patch_runtime_secrets":
      return "Installing runtime secrets";
    case "get_live_url":
      return "Checking workers.dev";
    case "published":
      return "Published";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-extrabold">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs font-semibold text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/8 bg-card/70 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

type FunnelWorkspaceTab = "steps" | "stats" | "settings";

const FUNNEL_TABS: Array<{ value: FunnelWorkspaceTab; label: string }> = [
  { value: "steps", label: "Steps" },
  { value: "stats", label: "Stats" },
  { value: "settings", label: "Settings" },
];

function FunnelEditorHeader({
  name,
  slug,
  activeTab,
  onTab,
  onBack,
}: {
  name: string;
  slug: string;
  activeTab: FunnelWorkspaceTab;
  onTab: (tab: FunnelWorkspaceTab) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All funnels
      </button>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">/{slug}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" className="rounded-md border-border bg-card" aria-label="Open funnel preview">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <nav className="mt-4 flex gap-1 border-b border-border" aria-label="Funnel workspace tabs">
        {FUNNEL_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTab(tab.value)}
            className={`relative px-3 pb-2 pt-1 text-xs font-semibold after:absolute after:inset-x-1 after:bottom-[-1px] after:h-0.5 after:bg-primary ${
              activeTab === tab.value
                ? "text-primary after:opacity-100"
                : "text-muted-foreground after:opacity-0 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

type SimpleFormPageKey = "zip" | "contact" | "thank-you";
type SimpleFormEditableField =
  | "offer.headline"
  | "offer.subheadline"
  | "funnel.qualifyingLine"
  | "funnel.ctaLabel"
  | "trust.statement"
  | "contact.headline"
  | "contact.submitLabel"
  | "contact.consent.text"
  | "thankYou.headline"
  | "thankYou.message"
  | "inventory.headline"
  | "inventory.subheadline";

export function reorderSimpleFormProducts<T>(products: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= products.length || to >= products.length) {
    return [...products];
  }
  const next = [...products];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...products];
  next.splice(to, 0, moved);
  return next;
}

function EditableCanvasBlock({
  field,
  selected,
  onSelect,
  children,
}: {
  field: SimpleFormEditableField;
  selected: boolean;
  onSelect: (field: SimpleFormEditableField) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(field)}
      className={`group relative block w-full rounded-md border px-4 py-3 text-left transition ${
        selected
          ? "border-primary bg-blue-50 ring-2 ring-primary/15"
          : "border-transparent hover:border-primary/40 hover:bg-blue-50/60"
      }`}
    >
      <span className="absolute -right-2 -top-2 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground group-hover:block">
        Edit
      </span>
      {children}
    </button>
  );
}

function SimpleFormFieldInspector({
  field,
  config,
  onChange,
}: {
  field: SimpleFormEditableField;
  config: SimpleFormOperatorConfig;
  onChange: (config: SimpleFormOperatorConfig) => void;
}) {
  const value = (() => {
    switch (field) {
      case "offer.headline": return config.offer.headline;
      case "offer.subheadline": return config.offer.subheadline;
      case "funnel.qualifyingLine": return config.funnel.qualifyingLine;
      case "funnel.ctaLabel": return config.funnel.ctaLabel;
      case "trust.statement": return config.trust.statement;
      case "contact.headline": return config.contact.headline;
      case "contact.submitLabel": return config.contact.submitLabel;
      case "contact.consent.text": return config.contact.consent.text;
      case "thankYou.headline": return config.thankYou.headline;
      case "thankYou.message": return config.thankYou.message;
      case "inventory.headline": return config.inventory.headline;
      case "inventory.subheadline": return config.inventory.subheadline;
    }
  })();
  const multiline = field.endsWith("subheadline") || field.endsWith("message") || field.endsWith("statement") || field.endsWith("consent.text");
  const label = field
    .split(".")
    .at(-1)!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, letter => letter.toUpperCase());

  const update = (nextValue: string) => {
    switch (field) {
      case "offer.headline": onChange({ ...config, offer: { ...config.offer, headline: nextValue } }); break;
      case "offer.subheadline": onChange({ ...config, offer: { ...config.offer, subheadline: nextValue } }); break;
      case "funnel.qualifyingLine": onChange({ ...config, funnel: { ...config.funnel, qualifyingLine: nextValue } }); break;
      case "funnel.ctaLabel": onChange({ ...config, funnel: { ...config.funnel, ctaLabel: nextValue } }); break;
      case "trust.statement": onChange({ ...config, trust: { ...config.trust, statement: nextValue } }); break;
      case "contact.headline": onChange({ ...config, contact: { ...config.contact, headline: nextValue } }); break;
      case "contact.submitLabel": onChange({ ...config, contact: { ...config.contact, submitLabel: nextValue } }); break;
      case "contact.consent.text": onChange({ ...config, contact: { ...config.contact, consent: { ...config.contact.consent, text: nextValue } } }); break;
      case "thankYou.headline": onChange({ ...config, thankYou: { ...config.thankYou, headline: nextValue } }); break;
      case "thankYou.message": onChange({ ...config, thankYou: { ...config.thankYou, message: nextValue } }); break;
      case "inventory.headline": onChange({ ...config, inventory: { ...config.inventory, headline: nextValue } }); break;
      case "inventory.subheadline": onChange({ ...config, inventory: { ...config.inventory, subheadline: nextValue } }); break;
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected element</p>
        <p className="mt-1 text-sm font-semibold">{label}</p>
      </div>
      {multiline ? (
        <Textarea aria-label={`Edit ${label}`} value={value} onChange={event => update(event.target.value)} className="min-h-32 resize-y bg-white text-sm" />
      ) : (
        <Input aria-label={`Edit ${label}`} value={value} onChange={event => update(event.target.value)} className="bg-white text-sm" />
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Changes appear on the canvas immediately. Save before leaving the funnel.
      </p>
    </div>
  );
}

function FunnelStepsOverview({
  config,
  slug,
  saving,
  onConfigChange,
  onSave,
}: {
  config: SimpleFormOperatorConfig;
  slug: string;
  saving: boolean;
  onConfigChange: (config: SimpleFormOperatorConfig) => void;
  onSave: () => void;
}) {
  const [selectedStep, setSelectedStep] = useState<SimpleFormPageKey>("zip");
  const [selectedField, setSelectedField] = useState<SimpleFormEditableField>("offer.headline");
  const [draggedProduct, setDraggedProduct] = useState<number | null>(null);
  const steps: Array<{ key: SimpleFormPageKey; title: string; detail: string; defaultField: SimpleFormEditableField }> = [
    { key: "zip", title: "ZIP code", detail: "Qualify the service area", defaultField: "offer.headline" },
    { key: "contact", title: "Contact details", detail: "Collect the lead", defaultField: "contact.headline" },
    { key: "thank-you", title: "Thank you", detail: "Confirm the submission", defaultField: "thankYou.headline" },
  ];
  const selectedIndex = steps.findIndex(step => step.key === selectedStep);
  const selected = steps[selectedIndex] ?? steps[0]!;

  const chooseStep = (step: (typeof steps)[number]) => {
    setSelectedStep(step.key);
    setSelectedField(step.defaultField);
  };

  const canvas = selectedStep === "zip" ? (
    <div className="mx-auto w-full max-w-xl space-y-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto mb-5 grid h-12 w-28 place-items-center rounded border border-dashed border-slate-300 text-xs font-semibold text-slate-500">Client logo</div>
      <EditableCanvasBlock field="offer.headline" selected={selectedField === "offer.headline"} onSelect={setSelectedField}>
        <h2 className="text-center text-2xl font-bold text-slate-900">{config.offer.headline}</h2>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="offer.subheadline" selected={selectedField === "offer.subheadline"} onSelect={setSelectedField}>
        <p className="text-center text-sm leading-relaxed text-slate-600">{config.offer.subheadline}</p>
      </EditableCanvasBlock>
      <div className="mx-4 mt-3 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-400">Enter ZIP code</div>
      <EditableCanvasBlock field="funnel.ctaLabel" selected={selectedField === "funnel.ctaLabel"} onSelect={setSelectedField}>
        <div className="rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">{config.funnel.ctaLabel}</div>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="funnel.qualifyingLine" selected={selectedField === "funnel.qualifyingLine"} onSelect={setSelectedField}>
        <p className="text-center text-xs leading-relaxed text-slate-500">{config.funnel.qualifyingLine}</p>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="trust.statement" selected={selectedField === "trust.statement"} onSelect={setSelectedField}>
        <p className="text-center text-xs leading-relaxed text-slate-500">{config.trust.statement}</p>
      </EditableCanvasBlock>
    </div>
  ) : selectedStep === "contact" ? (
    <div className="mx-auto w-full max-w-xl space-y-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <EditableCanvasBlock field="contact.headline" selected={selectedField === "contact.headline"} onSelect={setSelectedField}>
        <h2 className="text-center text-2xl font-bold text-slate-900">{config.contact.headline}</h2>
      </EditableCanvasBlock>
      {["First name", "Last name", "Phone", ...(config.contact.emailRequired ? ["Email"] : [])].map(label => (
        <div key={label} className="mx-4 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-400">{label}</div>
      ))}
      <EditableCanvasBlock field="contact.consent.text" selected={selectedField === "contact.consent.text"} onSelect={setSelectedField}>
        <p className="text-[10px] leading-relaxed text-slate-500">{config.contact.consent.text}</p>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="contact.submitLabel" selected={selectedField === "contact.submitLabel"} onSelect={setSelectedField}>
        <div className="rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">{config.contact.submitLabel}</div>
      </EditableCanvasBlock>
    </div>
  ) : (
    <div className="mx-auto w-full max-w-2xl space-y-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-600">✓</div>
      <EditableCanvasBlock field="thankYou.headline" selected={selectedField === "thankYou.headline"} onSelect={setSelectedField}>
        <h2 className="text-center text-2xl font-bold text-slate-900">{config.thankYou.headline}</h2>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="thankYou.message" selected={selectedField === "thankYou.message"} onSelect={setSelectedField}>
        <p className="text-center text-sm leading-relaxed text-slate-600">{config.thankYou.message}</p>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="inventory.headline" selected={selectedField === "inventory.headline"} onSelect={setSelectedField}>
        <h3 className="pt-3 text-lg font-bold text-slate-900">{config.inventory.headline}</h3>
      </EditableCanvasBlock>
      <EditableCanvasBlock field="inventory.subheadline" selected={selectedField === "inventory.subheadline"} onSelect={setSelectedField}>
        <p className="text-sm leading-relaxed text-slate-600">{config.inventory.subheadline}</p>
      </EditableCanvasBlock>
      <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold text-slate-500"><GripVertical className="h-3.5 w-3.5" /> Drag inventory cards to change their published order.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {config.inventory.products.map((product, index) => (
          <div
            key={product.id}
            draggable
            onDragStart={() => setDraggedProduct(index)}
            onDragEnd={() => setDraggedProduct(null)}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (draggedProduct === null) return;
              onConfigChange({
                ...config,
                inventory: {
                  ...config.inventory,
                  products: reorderSimpleFormProducts(config.inventory.products, draggedProduct, index),
                },
              });
              setDraggedProduct(null);
            }}
            className={`flex cursor-grab items-center gap-2 rounded-md border bg-slate-50 p-3 text-xs text-slate-700 active:cursor-grabbing ${draggedProduct === index ? "border-primary opacity-50" : "border-slate-200"}`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate font-semibold">{product.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="mt-3 overflow-hidden rounded-md border border-border bg-card lg:grid lg:grid-cols-[225px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-blue-50/80 lg:min-h-[680px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Funnel steps
        </div>
        <div>
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => chooseStep(step)}
              className={`flex w-full items-center gap-3 border-b border-blue-100 px-4 py-3 text-left ${selectedStep === step.key ? "bg-white text-foreground" : "text-slate-600 hover:bg-white/60"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm ${selectedStep === step.key ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-500"}`}>
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{index + 1}. {step.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{step.detail}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </aside>

      <div className="min-w-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="text-sm font-semibold">{selectedIndex + 1}. {selected.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">/{slug}/{selected.key}</p>
          </div>
          <Button type="button" size="sm" disabled={saving} onClick={onSave} className="rounded-md text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save page
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <MousePointer2 className="h-3.5 w-3.5 shrink-0" /> Click any outlined page element to edit its real published content.
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(420px,1fr)_260px]">
          <div className="min-h-[520px] overflow-auto rounded-md border border-slate-200 bg-slate-100 p-4 sm:p-6">{canvas}</div>
          <div className="rounded-md border border-border bg-slate-50 p-4">
            <SimpleFormFieldInspector field={selectedField} config={config} onChange={onConfigChange} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FunnelStats({ funnelName }: { funnelName: string }) {
  const rows = ["ZIP code", "Contact details", "Thank you"];
  return (
    <section className="mt-3 overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{funnelName} performance</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Analytics will populate after the funnel receives traffic.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-md border-border bg-card text-xs">
          <BarChart3 className="h-3.5 w-3.5" /> Last 30 days
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th rowSpan={2} className="border-b border-r border-border px-4 py-2 text-left font-semibold">Funnel step</th>
              <th colSpan={2} className="border-b border-r border-border px-3 py-2 font-semibold">Page views</th>
              <th colSpan={2} className="border-b border-r border-border px-3 py-2 font-semibold">Leads</th>
              <th colSpan={2} className="border-b border-border px-3 py-2 font-semibold">Conversion</th>
            </tr>
            <tr>
              {['All', 'Unique', 'All', 'Rate', 'Completed', 'Rate'].map(label => (
                <th key={label} className="border-b border-r border-border px-3 py-2 font-medium last:border-r-0">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row} className={index % 2 ? "bg-slate-50/70" : "bg-white"}>
                <td className="border-r border-border px-4 py-3 font-semibold text-slate-600"><span className="mr-2 text-slate-400">▱</span>{index + 1}. {row}</td>
                {Array.from({ length: 6 }).map((_, cell) => (
                  <td key={cell} className="border-r border-border px-3 py-3 text-center text-slate-400 last:border-r-0">—</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImageSourcePicker({
  label,
  source,
  previewUrl,
  assets,
  onChange,
}: {
  label: string;
  source: SimpleFormImageSource;
  previewUrl: string;
  assets: Array<{ slot: string; storageUrl: string; filename: string }>;
  onChange: (source: SimpleFormImageSource) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-extrabold">{label}</p>
      <RadioGroup
        value={source.mode}
        onValueChange={value => {
          if (value === "template") onChange({ mode: "template" });
          else
            onChange({
              mode: "client-media",
              slot:
                source.mode === "client-media"
                  ? source.slot
                  : (assets[0]?.slot ?? "logo"),
            });
        }}
        className="gap-3"
      >
        <label className="flex items-start gap-3 rounded-xl border border-white/8 p-3">
          <RadioGroupItem value="template" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">Use Template Default</p>
            <img
              src={previewUrl}
              alt=""
              className="mt-3 max-h-28 rounded-lg object-cover"
            />
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-white/8 p-3">
          <RadioGroupItem value="client-media" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-extrabold">Use Client Media</p>
            {assets.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">
                Upload a photo in Media first.
              </p>
            ) : (
              <select
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-bold"
                value={
                  source.mode === "client-media" ? source.slot : assets[0]?.slot
                }
                onChange={event =>
                  onChange({ mode: "client-media", slot: event.target.value })
                }
              >
                {assets.map(asset => (
                  <option key={asset.slot} value={asset.slot}>
                    {asset.slot} · {asset.filename}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}

export function SimpleFormFunnelEditor({
  clientId,
  funnelId,
  onBack,
}: {
  clientId: number;
  funnelId: number;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const query = trpc.simpleForm.get.useQuery({ clientId, funnelId });
  const publishQuery = trpc.simpleForm.publishStatus.useQuery(
    { clientId, funnelId },
    {
      refetchInterval: state => publishPollInterval(state.state.data),
    }
  );
  const [record, setRecord] = useState<SimpleFormStoredRecord | null>(null);
  const [activeTab, setActiveTab] = useState<FunnelWorkspaceTab>("steps");
  const [zipText, setZipText] = useState("");
  const [activePublish, setActivePublish] = useState<{
    clientId: number;
    funnelId: number;
    value: SimpleFormPublishStatusView;
  } | null>(null);
  const authoritativePublishRef = useRef<{
    clientId: number;
    funnelId: number;
    value: SimpleFormPublishStatusView | null;
  } | null>(null);
  const [publishAdvanceControl, setPublishAdvanceControl] =
    useState<PublishAdvanceControllerState>(
      initialPublishAdvanceControllerState
    );
  const publishAdvanceControllerRef = useRef<PublishAdvanceController | null>(
    null
  );
  if (publishAdvanceControllerRef.current === null) {
    publishAdvanceControllerRef.current = createPublishAdvanceController(
      setPublishAdvanceControl
    );
  }
  const publishAdvanceController = publishAdvanceControllerRef.current;

  useEffect(() => {
    if (!query.data) return;
    setRecord(query.data.record);
    setZipText(query.data.record.config.serviceAreaZipCodes.join("\n"));
  }, [query.data]);

  useEffect(() => {
    setActiveTab("steps");
  }, [funnelId]);

  useEffect(
    () => () => publishAdvanceController.dispose(),
    [publishAdvanceController]
  );

  const saveMutation = trpc.simpleForm.save.useMutation({
    onSuccess: async view => {
      await utils.simpleForm.get.invalidate({ clientId, funnelId });
      setRecord(view.record);
      toast.success("Funnel settings saved.");
    },
    onError: error => toast.error(error.message),
  });
  const startPublishMutation = trpc.simpleForm.startPublish.useMutation({
    onSuccess: async status => {
      setActivePublish({ clientId, funnelId, value: status });
      await utils.simpleForm.publishStatus.invalidate({ clientId, funnelId });
    },
    onError: error => toast.error(error.message),
  });
  const advancePublishMutation = trpc.simpleForm.advancePublish.useMutation({
    onSuccess: async status => {
      publishAdvanceController.observeSuccessfulStatus(status);
      setActivePublish({ clientId, funnelId, value: status });
      await utils.simpleForm.publishStatus.invalidate({ clientId, funnelId });
    },
    onError: error => {
      publishAdvanceController.completeError();
      toast.error(error.message);
    },
    onSettled: () => {
      publishAdvanceController.completeRequest();
    },
  });
  const publishAdvancePending = advancePublishMutation.isPending;
  const mutatePublishAdvance = advancePublishMutation.mutate;

  const localPublish =
    activePublish?.clientId === clientId && activePublish.funnelId === funnelId
      ? activePublish.value
      : null;
  const previousAuthoritativePublish =
    authoritativePublishRef.current?.clientId === clientId &&
    authoritativePublishRef.current.funnelId === funnelId
      ? authoritativePublishRef.current.value
      : null;
  const publish = effectivePublishStatus(
    localPublish,
    previousAuthoritativePublish,
    publishQuery.data
  );
  authoritativePublishRef.current = { clientId, funnelId, value: publish };
  useEffect(() => {
    if (!publishQuery.data) return;
    publishAdvanceController.observeSuccessfulStatus(publishQuery.data);
  }, [publishAdvanceController, publishQuery.data]);

  useEffect(() => {
    if (!publish || publishAdvancePending) {
      publishAdvanceController.cancelScheduled();
      return;
    }
    publishAdvanceController.scheduleAutomatic(
      publish,
      publishAdvanceDelayMs(publish),
      () => {
        mutatePublishAdvance({ clientId, funnelId, retryFailed: false });
      }
    );
    return () => publishAdvanceController.cancelScheduled();
  }, [
    clientId,
    funnelId,
    mutatePublishAdvance,
    publish,
    publishAdvanceController,
    publishAdvancePending,
  ]);

  const config = record?.config;
  const patchConfig = (partial: Partial<SimpleFormOperatorConfig>) => {
    if (!record) return;
    setRecord({ ...record, config: { ...record.config, ...partial } });
  };

  const readiness = query.data?.readiness;
  const assets = query.data?.assets ?? [];
  const publishAction = publishActionForState(
    publish,
    publishAdvanceControl.pausedAfterErrorVersion
  );
  const publishBusy =
    startPublishMutation.isPending ||
    publishAdvancePending ||
    publishAdvanceControl.locked;
  const progress = publish?.progress ?? { completed: 0, total: 9 };

  if (query.isLoading || !record || !config) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="rounded-2xl border border-red-400/20 p-5 font-bold text-red-200">
        {query.error.message}
      </div>
    );
  }

  const funnelName = query.data?.funnel.name ?? config.client.name;
  const funnelSlug = query.data?.funnel.slug ?? "simple-form";
  const header = (
    <FunnelEditorHeader
      name={funnelName}
      slug={funnelSlug}
      activeTab={activeTab}
      onTab={setActiveTab}
      onBack={onBack}
    />
  );

  if (activeTab === "steps") {
    return (
      <div className="space-y-3">
        {header}
        <FunnelStepsOverview
          config={config}
          slug={funnelSlug}
          saving={saveMutation.isPending}
          onConfigChange={nextConfig => setRecord({ ...record, config: nextConfig })}
          onSave={() => saveMutation.mutate({ clientId, funnelId, record })}
        />
      </div>
    );
  }

  if (activeTab === "stats") {
    return (
      <div className="space-y-3">
        {header}
        <FunnelStats funnelName={funnelName} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              clientId,
              funnelId,
              record: {
                ...record,
                config: {
                  ...config,
                  serviceAreaZipCodes: parseServiceAreaZips(zipText),
                },
              },
            })
          }
          className="h-9 gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>

      <section className="rounded-2xl border border-white/8 bg-card/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
              Readiness
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">
              {query.data?.funnel.name}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-cyan-300">
              {readiness?.configurationReady
                ? "CONFIGURATION READY"
                : "Not ready"}
            </p>
            <p className="text-xs font-bold text-muted-foreground">
              {publish ? publishStepLabel(publish.step) : "Not published"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3 rounded-xl border border-white/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold">
                {publish ? publishStepLabel(publish.step) : "Ready to publish"}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {progress.completed} of {progress.total} publish steps complete
              </p>
            </div>
            {publishAction ? (
              <Button
                type="button"
                disabled={
                  publishBusy ||
                  (publishAction === "Publish" &&
                    !readiness?.configurationReady)
                }
                onClick={() => {
                  if (publishAction === "Publish") {
                    publishAdvanceController.resetForStart();
                    startPublishMutation.mutate({ clientId, funnelId });
                    return;
                  }
                  if (!publish) return;
                  publishAdvanceController.retry(publish, () => {
                    mutatePublishAdvance({
                      clientId,
                      funnelId,
                      retryFailed: true,
                    });
                  });
                }}
                className="h-11 gap-2 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
              >
                {publishBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {publishAction}
              </Button>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-[width]"
              style={{ width: `${publishProgressPercent(progress)}%` }}
            />
          </div>
          {publish?.error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm font-bold text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{publish.error}</span>
            </div>
          ) : null}
          {publish?.repositoryUrl ||
          (publish?.status === "published" && publish.liveUrl) ? (
            <div className="flex flex-wrap gap-4 text-sm font-extrabold">
              {publish.repositoryUrl ? (
                <a
                  href={publish.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-300"
                >
                  Repository
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {publish.status === "published" && publish.liveUrl ? (
                <a
                  href={publish.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-300"
                >
                  Live site
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(readiness?.sections ?? []).map(section => (
            <div
              key={section.key}
              className="rounded-xl border border-white/8 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-extrabold">{section.label}</p>
                {section.ready ? (
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Ready
                  </span>
                ) : (
                  <span className="text-sm font-extrabold text-amber-200">
                    Missing
                  </span>
                )}
              </div>
              {!section.ready ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium text-muted-foreground">
                  {section.missing.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Section title="Client integrations">
        <div className="space-y-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
          <p className="font-extrabold">One protected profile for this client</p>
          <p className="text-sm font-medium text-muted-foreground">
            GHL, Google Sheets, Meta, callback, and runtime values are entered once and reused by this funnel, every other funnel, and the website.
          </p>
          <Button
            type="button"
            onClick={() => setLocation(`/workspace/${clientId}/integrations`)}
            className="h-11 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            Open client integrations
          </Button>
        </div>
      </Section>

      <Section title="Client">
        <Field label="Business name shown on the funnel">
          <Input
            value={config.client.name}
            onChange={event =>
              patchConfig({
                client: { ...config.client, name: event.target.value },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Phone" hint="International format, such as +17015551234">
          <Input
            value={config.client.phone}
            onChange={event =>
              patchConfig({
                client: { ...config.client, phone: event.target.value },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <ImageSourcePicker
          label="Logo"
          source={record.imageSources.logo}
          previewUrl={SIMPLE_FORM_TEMPLATE_LOGO_URL}
          assets={assets}
          onChange={logo =>
            setRecord({
              ...record,
              imageSources: { ...record.imageSources, logo },
            })
          }
        />
      </Section>

      <Section title="Offer">
        <Field label="Headline">
          <Input
            value={config.offer.headline}
            onChange={event =>
              patchConfig({
                offer: { ...config.offer, headline: event.target.value },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Subheadline">
          <Textarea
            value={config.offer.subheadline}
            onChange={event =>
              patchConfig({
                offer: { ...config.offer, subheadline: event.target.value },
              })
            }
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Qualifying line">
          <Input
            value={config.funnel.qualifyingLine}
            onChange={event =>
              patchConfig({
                funnel: {
                  ...config.funnel,
                  qualifyingLine: event.target.value,
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Contact headline">
          <Textarea
            value={config.contact.headline}
            onChange={event =>
              patchConfig({
                contact: { ...config.contact, headline: event.target.value },
              })
            }
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Thank-you headline">
          <Input
            value={config.thankYou.headline}
            onChange={event =>
              patchConfig({
                thankYou: { ...config.thankYou, headline: event.target.value },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Thank-you message">
          <Textarea
            value={config.thankYou.message}
            onChange={event =>
              patchConfig({
                thankYou: { ...config.thankYou, message: event.target.value },
              })
            }
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Service Area">
        <Field label="ZIP codes" hint="One ZIP per line. Example: 58701">
          <Textarea
            value={zipText}
            onChange={event => setZipText(event.target.value)}
            className="min-h-36 rounded-xl border-white/10 bg-white/[0.035] font-mono"
          />
        </Field>
        <Field
          label="ZIP results headline"
          hint="Must include {city} and {state}"
        >
          <Input
            value={config.geoH1Template}
            onChange={event =>
              patchConfig({ geoH1Template: event.target.value })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Out of area headline">
          <Input
            value={config.outOfArea.headline}
            onChange={event =>
              patchConfig({
                outOfArea: {
                  ...config.outOfArea,
                  headline: event.target.value,
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Out of area message">
          <Textarea
            value={config.outOfArea.message}
            onChange={event =>
              patchConfig({
                outOfArea: { ...config.outOfArea, message: event.target.value },
              })
            }
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Meta">
        <Field label="Lead conversion value">
          <Input
            type="number"
            min={0}
            value={config.meta.defaultConversionValue}
            onChange={event =>
              patchConfig({
                meta: {
                  ...config.meta,
                  defaultConversionValue: Number(event.target.value) || 0,
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Offline conversion">
        <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.025] p-4">
          <p className="text-sm font-extrabold">
            Offline conversion callback stages
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            Allowed callback stages:{" "}
            {offlineConversionOperatorGuidance().allowedCallbackStages.join(
              "/"
            )}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-muted-foreground">
            {offlineConversionOperatorGuidance().stageMappings.map(mapping => (
              <li key={mapping}>{mapping}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Inventory">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3">
          <p className="font-extrabold">Show inventory on thank-you</p>
          <Switch
            checked={config.inventory.enabled}
            onCheckedChange={enabled =>
              patchConfig({ inventory: { ...config.inventory, enabled } })
            }
          />
        </div>
        <Field label="Inventory headline">
          <Input
            value={config.inventory.headline}
            onChange={event =>
              patchConfig({
                inventory: {
                  ...config.inventory,
                  headline: event.target.value,
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        {config.inventory.products.map((product, index) => (
          <div
            key={product.id}
            className="space-y-3 rounded-xl border border-white/8 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold">Slot {index + 1}</p>
              <label className="flex items-center gap-2 text-sm font-extrabold">
                Active
                <Switch
                  checked={product.active}
                  onCheckedChange={active => {
                    const products = config.inventory.products.map(
                      (item, itemIndex) =>
                        itemIndex === index ? { ...item, active } : item
                    );
                    patchConfig({
                      inventory: { ...config.inventory, products },
                    });
                  }}
                />
              </label>
            </div>
            <Field label="Name">
              <Input
                value={product.name}
                onChange={event => {
                  const products = config.inventory.products.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, name: event.target.value }
                        : item
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={product.description ?? ""}
                onChange={event => {
                  const products = config.inventory.products.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="min-h-20 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Price label">
                <Input
                  value={product.priceLabel ?? ""}
                  onChange={event => {
                    const products = config.inventory.products.map(
                      (item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, priceLabel: event.target.value }
                          : item
                    );
                    patchConfig({
                      inventory: { ...config.inventory, products },
                    });
                  }}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
                />
              </Field>
              <Field label="CTA label">
                <Input
                  value={product.ctaLabel}
                  onChange={event => {
                    const products = config.inventory.products.map(
                      (item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, ctaLabel: event.target.value }
                          : item
                    );
                    patchConfig({
                      inventory: { ...config.inventory, products },
                    });
                  }}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
                />
              </Field>
            </div>
            <Field label="CTA URL" hint="https://… or tel:+1…">
              <Input
                value={product.ctaUrl}
                onChange={event => {
                  const products = config.inventory.products.map(
                    (item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, ctaUrl: event.target.value }
                        : item
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <ImageSourcePicker
              label="Product / Template Image"
              source={
                record.imageSources.products[index] ?? { mode: "template" }
              }
              previewUrl={
                SIMPLE_FORM_TEMPLATE_PRODUCTS[index]?.imageUrl ??
                product.imageUrl
              }
              assets={assets}
              onChange={source => {
                const products = record.imageSources.products.map(
                  (item, itemIndex) => (itemIndex === index ? source : item)
                );
                setRecord({
                  ...record,
                  imageSources: { ...record.imageSources, products },
                });
              }}
            />
          </div>
        ))}
      </Section>

      <Section title="Consent">
        <Field label="Consent version">
          <Input
            value={config.contact.consent.version}
            onChange={event =>
              patchConfig({
                contact: {
                  ...config.contact,
                  consent: {
                    ...config.contact.consent,
                    version: event.target.value,
                  },
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Consent text">
          <Textarea
            value={config.contact.consent.text}
            onChange={event =>
              patchConfig({
                contact: {
                  ...config.contact,
                  consent: {
                    ...config.contact.consent,
                    text: event.target.value,
                  },
                },
              })
            }
            className="min-h-32 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Optional Analytics">
        <Field label="GA4 Measurement ID" hint="Optional. Example: G-ABC1234">
          <Input
            value={config.ga4MeasurementId ?? ""}
            onChange={event =>
              patchConfig({ ga4MeasurementId: event.target.value || undefined })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono"
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3">
          <p className="font-extrabold">Google enhanced conversions</p>
          <Switch
            checked={config.googleEnhancedConversions}
            onCheckedChange={googleEnhancedConversions =>
              patchConfig({ googleEnhancedConversions })
            }
          />
        </div>
      </Section>
    </div>
  );
}
