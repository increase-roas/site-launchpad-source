import { StatusDot } from "@/components/StatusDot";
import { WorkspaceModeTabs } from "@/components/WorkspaceModeTabs";
import { FunnelBuilderList } from "@/components/funnels/FunnelBuilderList";
import { FunnelConfigEditor } from "@/components/funnels/FunnelConfigEditor";
import { SimpleFormFunnelEditor } from "@/components/funnels/SimpleFormFunnelEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FUNNEL_SHAPE_LABELS, FUNNEL_SHAPE_VALUES, type FunnelShape, type FunnelStepType } from "@shared/workspace";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  ContactRound,
  Edit3,
  Loader2,
  MapPin,
  MousePointerClick,
  Route,
  Save,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaidAdsFunnelLibrary } from "@/components/funnels/studio/PaidAdsFunnelLibrary";
import { resolveRegistryTemplates } from "@/lib/studio/funnelLibrary";
import { PaidFunnelBuilder } from "@/components/funnels/studio/PaidFunnelBuilder";
import {
  commitAutosave,
  createDocumentFromPersist,
  createStudioState,
  parsePaidAdsFunnelSearch,
  studioToStorageGraph,
  type PaidAdsFunnelTab,
  type StudioState,
} from "@shared/paidFunnel";
import { selectedFunnelForClient } from "./editorIsolation";

type Step = {
  id: number;
  funnelId: number;
  stepType: FunnelStepType;
  position: number;
  title: string;
  path: string;
  capturedFields: string[];
  trackingActions: string[];
};

const STEP_ICONS: Record<FunnelStepType, typeof MapPin> = {
  zip: MapPin,
  survey: ClipboardList,
  contact: ContactRound,
  book: CalendarCheck2,
  thankYou: CheckCircle2,
};

const SHAPE_FLOWS: Record<FunnelShape, string> = {
  A: "ZIP → Thank You",
  B: "ZIP → Survey → Contact → Thank You",
  C: "ZIP → Survey → Contact → Book → Thank You",
};

function StepCard({ step, onEdit }: { step: Step; onEdit: () => void }) {
  const Icon = STEP_ICONS[step.stepType];
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group min-h-[220px] w-[210px] shrink-0 rounded-2xl border border-white/9 bg-[#0c1622] p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:border-cyan-300/35 hover:bg-cyan-400/[0.035]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/12">
          <Icon className="h-5 w-5" />
        </span>
        <Edit3 className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-cyan-300" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">{step.title}</h3>
      <p className="mt-1 truncate text-xs font-extrabold text-cyan-300">{step.path}</p>
      <div className="mt-4 space-y-2.5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Captured here</p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-foreground/80">
            {step.capturedFields.length ? step.capturedFields.join(", ") : "Nothing"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Tracking</p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-foreground/80">
            {step.trackingActions.length ? step.trackingActions.join(", ") : "Nothing"}
          </p>
        </div>
      </div>
    </button>
  );
}

function StepEditor({
  step,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  step: Step | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { title: string; path: string; capturedFields: string[]; trackingActions: string[] }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [fields, setFields] = useState("");
  const [tracking, setTracking] = useState("");

  useEffect(() => {
    if (!step) return;
    setTitle(step.title);
    setPath(step.path);
    setFields(step.capturedFields.join("\n"));
    setTracking(step.trackingActions.join("\n"));
  }, [step]);

  const lines = (value: string) =>
    value
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-popover sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Edit funnel step</DialogTitle>
          <DialogDescription className="font-medium leading-relaxed">
            Update what this step is called, where it lives, what it asks for, and what tracking runs.
          </DialogDescription>
        </DialogHeader>
        {step ? (
          <div className="mt-3 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-extrabold">Step name</span>
              <Input value={title} onChange={event => setTitle(event.target.value)} className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-extrabold">Page path</span>
              <Input value={path} onChange={event => setPath(event.target.value)} placeholder="/qualified-lead/contact" className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono text-sm" />
              <span className="block text-xs font-semibold text-muted-foreground">Start with / and do not use spaces.</span>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-extrabold">Information collected</span>
              <Textarea value={fields} onChange={event => setFields(event.target.value)} placeholder={"First Name\nEmail\nPhone"} className="min-h-32 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed" />
              <span className="block text-xs font-semibold text-muted-foreground">Put one item on each line.</span>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-extrabold">Tracking that runs</span>
              <Textarea value={tracking} onChange={event => setTracking(event.target.value)} placeholder={"LeadStarted\nLead"} className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed" />
              <span className="block text-xs font-semibold text-muted-foreground">Put one action on each line.</span>
            </label>
            <Button
              type="button"
              disabled={saving}
              onClick={() => onSave({ title, path, capturedFields: lines(fields), trackingActions: lines(tracking) })}
              className="h-13 w-full gap-2 rounded-xl bg-cyan-400 text-base font-extrabold text-slate-950 hover:bg-cyan-300"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Save step
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function PaidAdsWorkspace({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });
  const templatesQuery = trpc.paidFunnel.listTemplates.useQuery({ clientId }, { retry: 1 });
  const registryFunnelsQuery = trpc.paidFunnel.listFunnels.useQuery({ clientId }, { retry: 1 });
  const resolvedTemplates = resolveRegistryTemplates({
    remote: templatesQuery.data,
    isLoading: templatesQuery.isLoading,
    errorMessage: templatesQuery.error?.message ?? null,
  });
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const parsedSearch = parsePaidAdsFunnelSearch(typeof window === "undefined" ? "" : window.location.search);
  const initialStudioId = parsedSearch.studioKey && /^\d+$/.test(parsedSearch.studioKey) ? Number(parsedSearch.studioKey) : null;
  const [studioFunnelId, setStudioFunnelId] = useState<number | null>(initialStudioId);
  const [libraryTab, setLibraryTab] = useState<PaidAdsFunnelTab>(parsedSearch.tab);
  const [studio, setStudio] = useState<StudioState | null>(null);

  const studioDetailQuery = trpc.paidFunnel.get.useQuery(
    { clientId, funnelId: studioFunnelId ?? 0 },
    { enabled: studioFunnelId != null },
  );

  const saveGraphMutation = trpc.paidFunnel.saveGraph.useMutation({
    onSuccess: async detail => {
      await utils.paidFunnel.get.invalidate({ clientId, funnelId: detail.funnel.id });
      await utils.paidFunnel.listFunnels.invalidate({ clientId });
      if (!detail.studio) return;
      setStudio(current => {
        if (!current) return current;
        return commitAutosave(current, current.document.revision, {
          expectedUpdatedAt: new Date(detail.studio!.expectedUpdatedAt).toISOString(),
          stepId: detail.studio!.stepId,
        });
      });
    },
    onError: error => {
      setStudio(current =>
        current
          ? {
              ...current,
              document: {
                ...current.document,
                saveStatus: "error",
                conflict: /updated elsewhere|conflict/i.test(error.message),
              },
            }
          : current,
      );
      toast.error(error.message);
    },
  });

  const createFromTemplateMutation = trpc.paidFunnel.createFromTemplate.useMutation({
    onSuccess: async result => {
      await utils.paidFunnel.listFunnels.invalidate({ clientId });
      await utils.paidFunnel.listTemplates.invalidate({ clientId });
      openStudioFunnel(result.funnelId);
      toast.success(result.alreadyExists ? "Opened existing paid funnel." : "Paid funnel created.");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    setSelectedStep(null);
    setStudio(null);
    setStudioFunnelId(null);
  }, [clientId]);

  useEffect(() => {
    if (!workspaceQuery.data) return;
    const ownedIds = workspaceQuery.data.funnels.map(funnel => funnel.id);
    const requested = Number(new URLSearchParams(window.location.search).get("funnel"));
    const requestedId = Number.isInteger(requested) && requested > 0 ? requested : null;
    const fromUrl = selectedFunnelForClient(requestedId, ownedIds);
    setSelectedFunnelId(current => (current && ownedIds.includes(current) ? current : fromUrl));
    if (requestedId != null && !ownedIds.includes(requestedId)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [clientId, workspaceQuery.data]);

  useEffect(() => {
    if (studio) return;
    if (!studioDetailQuery.data?.studio || studioFunnelId == null) return;
    const assembled = studioDetailQuery.data.studio;
    setStudio(
      createStudioState(
        createDocumentFromPersist({
          clientId,
          funnelId: studioFunnelId,
          stepId: assembled.stepId,
          expectedUpdatedAt: assembled.expectedUpdatedAt,
          graph: assembled.graph,
        }),
      ),
    );
  }, [clientId, studio, studioFunnelId, studioDetailQuery.data]);

  const openFunnel = (funnelId: number) => {
    setSelectedFunnelId(funnelId);
    setStudio(null);
    setStudioFunnelId(null);
    window.history.replaceState(null, "", `${window.location.pathname}?funnel=${funnelId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeFunnel = () => {
    setSelectedFunnelId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const openStudioFunnel = (funnelId: number) => {
    setSelectedFunnelId(null);
    setStudioFunnelId(funnelId);
    window.history.replaceState(null, "", `${window.location.pathname}?studio=${funnelId}`);
  };

  const closeStudio = () => {
    setStudio(null);
    setStudioFunnelId(null);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${libraryTab}`);
  };

  useEffect(() => {
    if (!studio || studio.document.saveStatus !== "saving") return;
    if (!studio.document.funnelId || !studio.document.stepId || !studio.document.expectedUpdatedAt) return;
    if (saveGraphMutation.isPending) return;
    const snapshot = studio;
    const handle = window.setTimeout(() => {
      if (!snapshot.document.funnelId || !snapshot.document.stepId || !snapshot.document.expectedUpdatedAt) return;
      saveGraphMutation.mutate({
        clientId,
        funnelId: snapshot.document.funnelId,
        stepId: snapshot.document.stepId,
        expectedUpdatedAt: new Date(snapshot.document.expectedUpdatedAt),
        graph: studioToStorageGraph(snapshot.document.graph),
      });
    }, 450);
    return () => window.clearTimeout(handle);
    // Key off editSeq so every graph mutation schedules saveGraph.
  }, [studio?.document.editSeq, studio?.document.saveStatus, clientId]);

  const shapeMutation = trpc.workspace.setFunnelShape.useMutation({
    onSuccess: async () => {
      await utils.workspace.get.invalidate({ clientId });
      toast.success("Funnel shape changed.");
    },
    onError: error => toast.error(error.message),
  });

  const stepMutation = trpc.workspace.updateStep.useMutation({
    onSuccess: async () => {
      await utils.workspace.get.invalidate({ clientId });
      setSelectedStep(null);
      toast.success("Funnel step saved.");
    },
    onError: error => toast.error(error.message),
  });

  if (workspaceQuery.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>;
  }

  if (!workspaceQuery.data) {
    return <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center font-extrabold">Paid Ads funnels could not be loaded.</div>;
  }

  const workspace = workspaceQuery.data;
  const selectedFromWorkspace = workspace.funnels.find(funnel => funnel.id === selectedFunnelId);
  const selectedIsSimpleForm = selectedFromWorkspace?.templateKey === "simple-form";
  const legacyFunnels = workspace.funnels.filter(funnel => !funnel.templateKey);

  return (
    <div className="mx-auto w-full max-w-[1580px] space-y-7">
      <section className="flex flex-col gap-5 rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_88%_-10%,rgba(34,211,238,0.14),transparent_35%),rgba(17,26,37,0.88)] p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Paid Ads workspace</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            {workspace.client.businessName} funnels
          </h1>
          <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground">
            See the full customer path, what each step collects, and what tracking runs.
          </p>
        </div>
        <WorkspaceModeTabs clientId={clientId} active="paidAds" />
      </section>

      {studio ? (
        <PaidFunnelBuilder clientId={clientId} state={studio} onChange={setStudio} onBack={closeStudio} />
      ) : selectedFunnelId ? (
        selectedIsSimpleForm ? (
          <SimpleFormFunnelEditor
            clientId={clientId}
            funnelId={selectedFunnelId}
            onBack={closeFunnel}
          />
        ) : (
          <FunnelConfigEditor
            clientId={clientId}
            funnelId={selectedFunnelId}
            onBack={closeFunnel}
          />
        )
      ) : (
        <div className="space-y-8">
          <PaidAdsFunnelLibrary
            tab={libraryTab}
            creating={createFromTemplateMutation.isPending}
            templates={resolvedTemplates.templates}
            templatesLoading={resolvedTemplates.templatesLoading}
            templatesError={resolvedTemplates.errorMessage}
            funnels={registryFunnelsQuery.data ?? []}
            funnelsLoading={registryFunnelsQuery.isLoading && !registryFunnelsQuery.isError}
            onTabChange={tab => {
              setLibraryTab(tab);
              window.history.replaceState(null, "", `${window.location.pathname}?tab=${tab}`);
            }}
            onCreateFromTemplate={templateKey => createFromTemplateMutation.mutate({ clientId, templateKey })}
            onOpenFunnel={openStudioFunnel}
          />
          <FunnelBuilderList clientId={clientId} onEdit={openFunnel} />
        </div>
      )}

      {!studio && legacyFunnels.length > 0 ? (
      <>
      <section className="pt-2">
        <div className="mb-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Funnel structure maps</p>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Shape and step view</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Legacy Shape A, B, and C controls remain available for older funnels.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FUNNEL_SHAPE_VALUES.map(shape => (
          <div key={shape} className="rounded-2xl border border-white/8 bg-card/55 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-lg font-extrabold text-cyan-300">{shape}</span>
              <div>
                <p className="font-extrabold">{FUNNEL_SHAPE_LABELS[shape]}</p>
                <p className="mt-0.5 text-xs font-bold text-muted-foreground">{SHAPE_FLOWS[shape]}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        {legacyFunnels.map(funnel => {
          const statusTone = funnel.status === "live" ? "green" : funnel.status === "issue" ? "red" : "yellow";
          return (
            <Card key={funnel.id} className="overflow-hidden border-white/8 bg-card/70 p-0 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col gap-5 border-b border-white/8 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/12">
                    <Route className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl font-extrabold">{funnel.name}</h2>
                      <StatusDot good={statusTone === "green"} tone={statusTone} label={funnel.status === "live" ? "Live" : funnel.status === "issue" ? "Issues" : "In progress"} compact />
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">/{funnel.slug}</p>
                    <p className="mt-2 text-sm font-extrabold text-cyan-300">Active: {FUNNEL_SHAPE_LABELS[funnel.shape]}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {FUNNEL_SHAPE_VALUES.map(shape => (
                    <button
                      key={shape}
                      type="button"
                      disabled={shapeMutation.isPending}
                      onClick={() => shapeMutation.mutate({ clientId, funnelId: funnel.id, shape })}
                      className={`h-10 min-w-12 rounded-xl border px-3 text-sm font-extrabold ${
                        funnel.shape === shape
                          ? "border-cyan-400 bg-cyan-400 text-slate-950"
                          : "border-white/10 bg-white/[0.025] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                      }`}
                      aria-label={`Use Shape ${shape} for ${funnel.name}`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  <MousePointerClick className="h-4 w-4 text-cyan-300" />
                  Click any step to edit it
                </div>
                <div className="mt-4 overflow-x-auto pb-2">
                  <div className="flex min-w-max items-center gap-3">
                    {funnel.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <StepCard step={step as Step} onEdit={() => setSelectedStep(step as Step)} />
                        {index < funnel.steps.length - 1 ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/8 text-cyan-300">
                            <ArrowRight className="h-5 w-5" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.035] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-extrabold">Shape changes rebuild the full path</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
              Choose A, B, or C above. The exact required steps appear automatically, then each step can be adjusted.
            </p>
          </div>
        </div>
      </section>
      </>
      ) : null}

      <StepEditor
        step={selectedStep}
        open={Boolean(selectedStep)}
        onOpenChange={open => !open && setSelectedStep(null)}
        saving={stepMutation.isPending}
        onSave={input => {
          if (!selectedStep) return;
          stepMutation.mutate({ clientId, step: { stepId: selectedStep.id, ...input } });
        }}
      />
    </div>
  );
}
