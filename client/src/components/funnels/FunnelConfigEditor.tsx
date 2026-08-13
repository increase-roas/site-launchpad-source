import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  DEPLOY_SUCCESS_MESSAGE,
  SURVEY_QUESTION_TYPE_VALUES,
  funnelEditorInputSchema,
  funnelFormStepCount,
  funnelStepCount,
  type FunnelEditorInput,
  type SurveyQuestionInput,
  type SurveyQuestionType,
} from "@shared/funnelConfig";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  GripVertical,
  Loader2,
  MapPin,
  Plus,
  Rocket,
  Save,
  Send,
  Settings2,
  Trash2,
  UserRound,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { shouldAdoptRemoteFormAfterSave, shouldHydrateRemoteForm } from "@/pages/editorIsolation";

type QuestionDraft = SurveyQuestionInput & { localKey: string };
type FormDraft = Omit<FunnelEditorInput, "questions"> & { questions: QuestionDraft[] };

function formFromDetail(detail: {
  funnel: { name: string; slug: string };
  config: {
    serviceArea: string;
    offerHeadline: string;
    offerSubheadline: string;
    thankYouMessage: string;
  };
  profile: { serviceArea: string };
  questions: Array<{
    id?: number;
    questionText: string;
    questionType: SurveyQuestionType;
    options: string[];
  }>;
}): FormDraft {
  return {
    name: detail.funnel.name,
    slug: detail.funnel.slug,
    serviceArea: detail.config.serviceArea || detail.profile.serviceArea,
    offerHeadline: detail.config.offerHeadline,
    offerSubheadline: detail.config.offerSubheadline,
    thankYouMessage: detail.config.thankYouMessage,
    questions: detail.questions.map(question => ({
      id: question.id,
      localKey: question.id ? `saved-${question.id}` : crypto.randomUUID(),
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options,
    })),
  };
}

function draftFingerprint(form: FormDraft): string {
  return JSON.stringify({
    name: form.name,
    slug: form.slug,
    serviceArea: form.serviceArea,
    offerHeadline: form.offerHeadline,
    offerSubheadline: form.offerSubheadline,
    thankYouMessage: form.thankYouMessage,
    questions: form.questions.map(question => ({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options,
    })),
  });
}

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  radio: "Single choice",
  checkbox: "Multiple choice",
  text: "Text answer",
};

function statusStyle(status: "draft" | "ready" | "deployed") {
  if (status === "deployed") {
    return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200";
  }
  if (status === "ready") {
    return "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200";
  }
  return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
}

function FlowPreview({ questions }: { questions: QuestionDraft[] }) {
  const steps = [
    { key: "zip", label: "ZIP", detail: "Service area" },
    ...questions.map((question, index) => ({
      key: question.localKey,
      label: `Q${index + 1}`,
      detail: question.questionText || "Survey question",
    })),
    { key: "contact", label: "Contact", detail: "Name, email, phone" },
    { key: "thank-you", label: "Thank You", detail: "Confirmation" },
  ];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-2.5">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2.5">
            <div className="w-40 rounded-2xl border border-white/9 bg-[#0b1521] p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/10 text-xs font-extrabold text-cyan-300">
                  {index + 1}
                </span>
                <p className="text-sm font-extrabold">{step.label}</p>
              </div>
              <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </div>
            {index < steps.length - 1 ? (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-400/8 text-cyan-300">
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onChange,
  onRemove,
  onMove,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const updateType = (questionType: SurveyQuestionType) => {
    onChange({
      ...question,
      questionType,
      options:
        questionType === "text"
          ? []
          : question.options.length >= 2
            ? question.options
            : ["Option 1", "Option 2"],
    });
  };

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        onDrop();
      }}
      className={`border-white/8 p-4 sm:p-5 ${dragging ? "border-cyan-300/45 bg-cyan-400/[0.045]" : "bg-card/70"}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="grid h-10 w-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.04]"
          aria-label={`Drag question ${index + 1}`}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-sm font-extrabold text-cyan-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px]">
            <label className="space-y-2">
              <span className="text-sm font-extrabold">Question</span>
              <Input
                value={question.questionText}
                onChange={event => onChange({ ...question, questionText: event.target.value })}
                placeholder="What are you interested in?"
                className="h-12 rounded-xl border-white/10 bg-black/15 text-base"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-extrabold">Answer type</span>
              <Select value={question.questionType} onValueChange={value => updateType(value as SurveyQuestionType)}>
                <SelectTrigger className="h-12 rounded-xl border-white/10 bg-black/15 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-popover">
                  {SURVEY_QUESTION_TYPE_VALUES.map(type => (
                    <SelectItem key={type} value={type}>
                      {QUESTION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {question.questionType !== "text" ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold">Answer choices</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...question, options: [...question.options, `Option ${question.options.length + 1}`] })}
                  className="h-9 gap-1.5 rounded-lg border-white/10 bg-white/[0.025] font-extrabold"
                >
                  <Plus className="h-3.5 w-3.5" /> Add choice
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <div key={`${question.localKey}-${optionIndex}`} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={event =>
                        onChange({
                          ...question,
                          options: question.options.map((item, currentIndex) =>
                            currentIndex === optionIndex ? event.target.value : item,
                          ),
                        })
                      }
                      className="h-11 rounded-xl border-white/10 bg-black/15"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onChange({
                          ...question,
                          options: question.options.filter((_, currentIndex) => currentIndex !== optionIndex),
                        })
                      }
                      className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-300"
                      aria-label={`Remove choice ${optionIndex + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-white/[0.03] p-3 text-sm font-semibold text-muted-foreground">
              The customer will type a free-form answer.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} className="h-9 w-9" aria-label="Move question up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(1)} className="h-9 w-9" aria-label="Move question down">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-9 w-9 text-muted-foreground hover:text-red-300" aria-label="Remove question">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function FunnelConfigEditor({
  clientId,
  funnelId,
  onBack,
}: {
  clientId: number;
  funnelId: number;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const detailQuery = trpc.funnelBuilder.get.useQuery({ clientId, funnelId });
  const [form, setForm] = useState<FormDraft | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deployMessage, setDeployMessage] = useState("");
  const [exportedConfig, setExportedConfig] = useState("");
  const formRef = useRef<FormDraft | null>(null);
  const lastHydratedFingerprint = useRef<string | null>(null);
  const inFlightFingerprintRef = useRef<string | null>(null);
  const pendingDeployRef = useRef(false);

  useEffect(() => {
    setExportedConfig("");
    setDeployMessage("");
    lastHydratedFingerprint.current = null;
    pendingDeployRef.current = false;
  }, [clientId, funnelId]);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    const incoming = formFromDetail(detail);
    const current = formRef.current;
    if (
      current &&
      !shouldHydrateRemoteForm(draftFingerprint(current), lastHydratedFingerprint.current)
    ) {
      return;
    }
    setForm(incoming);
    lastHydratedFingerprint.current = draftFingerprint(incoming);
  }, [detailQuery.data]);

  formRef.current = form;

  const deployMutation = trpc.funnelBuilder.deploy.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.funnelBuilder.get.invalidate({ clientId, funnelId }),
        utils.funnelBuilder.list.invalidate({ clientId }),
      ]);
      setDeployMessage(result.message);
      toast.success("Funnel is ready to deploy.");
    },
    onError: error => toast.error(error.message),
  });

  const exportMutation = trpc.funnelBuilder.exportGeneratedConfig.useMutation();

  const saveMutation = trpc.funnelBuilder.save.useMutation({
    onSuccess: async detail => {
      const sent = inFlightFingerprintRef.current;
      const current = formRef.current;
      const adoptRemote =
        Boolean(current && sent && shouldAdoptRemoteFormAfterSave(sent, draftFingerprint(current)));
      if (adoptRemote && current) {
        const next: FormDraft = {
          ...current,
          questions: detail.questions.map(question => ({
            id: question.id,
            localKey: `saved-${question.id}`,
            questionText: question.questionText,
            questionType: question.questionType,
            options: question.options,
          })),
        };
        setForm(next);
        formRef.current = next;
        lastHydratedFingerprint.current = draftFingerprint(next);
      }
      try {
        const exported = await exportMutation.mutateAsync({ clientId, funnelId });
        setExportedConfig(exported.contents);
      } catch {
        setExportedConfig("");
      }
      await Promise.all([
        utils.funnelBuilder.get.invalidate({ clientId, funnelId }),
        utils.funnelBuilder.list.invalidate({ clientId }),
        utils.workspace.get.invalidate({ clientId }),
      ]);
      setDeployMessage("");
      toast.success("Funnel saved and config generated.");
      if (pendingDeployRef.current && adoptRemote) {
        pendingDeployRef.current = false;
        deployMutation.mutate({ clientId, funnelId });
        return;
      }
      pendingDeployRef.current = false;
    },
    onError: error => {
      pendingDeployRef.current = false;
      toast.error(error.message);
    },
  });

  const markDeployedMutation = trpc.funnelBuilder.markDeployed.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.funnelBuilder.get.invalidate({ clientId, funnelId }),
        utils.funnelBuilder.list.invalidate({ clientId }),
        utils.workspace.get.invalidate({ clientId }),
      ]);
      toast.success("Funnel marked as deployed.");
    },
    onError: error => toast.error(error.message),
  });

  const generatedConfig = exportedConfig;
  const hasGeneratedConfig = Boolean(exportedConfig) || Boolean(detailQuery.data?.config.hasGeneratedConfig);
  const status = detailQuery.data?.funnel.deploymentStatus ?? "draft";
  const readyInstruction = deployMessage || (status === "ready" ? DEPLOY_SUCCESS_MESSAGE : "");

  const cleanInput = useMemo<FunnelEditorInput | null>(() => {
    if (!form) return null;
    return {
      name: form.name,
      slug: form.slug,
      serviceArea: form.serviceArea,
      offerHeadline: form.offerHeadline,
      offerSubheadline: form.offerSubheadline,
      thankYouMessage: form.thankYouMessage,
      questions: form.questions.map(({ localKey: _localKey, ...question }) => question),
    };
  }, [form]);

  const save = () => {
    if (!cleanInput) {
      pendingDeployRef.current = false;
      return;
    }
    const parsed = funnelEditorInputSchema.safeParse(cleanInput);
    if (!parsed.success) {
      pendingDeployRef.current = false;
      toast.error(parsed.error.issues[0]?.message ?? "A few funnel details need attention.");
      return;
    }
    if (formRef.current) inFlightFingerprintRef.current = draftFingerprint(formRef.current);
    saveMutation.mutate({ clientId, funnelId, config: parsed.data });
  };

  const requestDeploy = () => {
    const current = formRef.current;
    const dirty =
      Boolean(current) &&
      lastHydratedFingerprint.current !== null &&
      draftFingerprint(current!) !== lastHydratedFingerprint.current;
    if (dirty) {
      pendingDeployRef.current = true;
      save();
      return;
    }
    deployMutation.mutate({ clientId, funnelId });
  };

  const moveQuestion = (from: number, to: number) => {
    if (!form || from === to || to < 0 || to >= form.questions.length) return;
    const questions = [...form.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    setForm({ ...form, questions });
  };

  if (detailQuery.isLoading || !form) {
    return (
      <div className="grid min-h-[55vh] place-items-center rounded-3xl border border-white/8 bg-card/45">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
          <p className="mt-3 font-bold text-muted-foreground">Loading funnel editor…</p>
        </div>
      </div>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center">
        <p className="font-extrabold text-red-200">{detailQuery.error?.message ?? "Funnel could not be loaded."}</p>
        <Button type="button" onClick={onBack} className="mt-5 bg-cyan-400 font-extrabold text-slate-950">
          Back to funnels
        </Button>
      </div>
    );
  }

  const detail = detailQuery.data;
  const busy = saveMutation.isPending || deployMutation.isPending || markDeployedMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,0.13),transparent_38%),rgba(17,26,37,0.88)] p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button type="button" variant="ghost" onClick={onBack} className="-ml-3 h-10 gap-2 rounded-xl font-extrabold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to funnels
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight">{form.name}</h2>
            <span className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-extrabold capitalize ${statusStyle(status)}`}>
              {status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
            Build the offer and questions, generate the config, then mark it ready for the Wrangler step.
          </p>
        </div>
        <div className="hidden w-full gap-2 sm:grid sm:w-auto sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button type="button" disabled={busy} onClick={save} variant="outline" className="h-12 gap-2 rounded-xl border-white/10 bg-white/[0.03] px-5 font-extrabold">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save & Generate
          </Button>
          <Button type="button" disabled={busy || status === "deployed"} onClick={requestDeploy} className="h-12 gap-2 rounded-xl bg-cyan-400 px-5 font-extrabold text-slate-950 hover:bg-cyan-300">
            {deployMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Deploy Funnel
          </Button>
        </div>
      </section>

      {(detail.profile.missingSetup.length > 0 || readyInstruction) ? (
        <section className={`rounded-2xl border p-4 ${readyInstruction ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-amber-300/20 bg-amber-300/[0.06]"}`}>
          <div className="flex items-start gap-3">
            {readyInstruction ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{readyInstruction ? "Ready for the final command" : "Setup needed before deployment"}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
                {readyInstruction || `Ask Alex to add: ${detail.profile.missingSetup.join(", ")}. You can still build and generate the funnel now.`}
              </p>
              {readyInstruction && status === "ready" ? (
                <Button type="button" disabled={busy} onClick={() => markDeployedMutation.mutate({ clientId, funnelId })} variant="outline" className="mt-3 h-10 gap-2 rounded-xl border-emerald-300/20 bg-emerald-300/[0.05] font-extrabold text-emerald-200">
                  <Check className="h-4 w-4" /> Mark deployed after running Wrangler
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Card className="border-white/8 bg-card/70 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><UserRound className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Auto-filled</p>
                <h3 className="text-xl font-extrabold">Client profile</h3>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-extrabold">Business name</span><Input readOnly value={detail.profile.businessName} className="h-12 rounded-xl border-white/8 bg-black/20" /></label>
              <label className="space-y-2"><span className="text-sm font-extrabold">Phone</span><Input readOnly value={detail.profile.phone} className="h-12 rounded-xl border-white/8 bg-black/20" /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-extrabold">Service area</span><Input value={form.serviceArea} onChange={event => setForm({ ...form, serviceArea: event.target.value })} className="h-12 rounded-xl border-white/10 bg-black/15" /></label>
              <label className="space-y-2"><span className="flex items-center gap-2 text-sm font-extrabold"><Zap className="h-4 w-4 text-cyan-300" /> Meta Pixel ID</span><Input readOnly value={detail.profile.hasMetaPixelId ? "Saved in setup" : ""} placeholder="Missing in setup" className="h-12 rounded-xl border-white/8 bg-black/20" /></label>
              <label className="space-y-2"><span className="flex items-center gap-2 text-sm font-extrabold"><Webhook className="h-4 w-4 text-cyan-300" /> GHL webhook URL</span><Input readOnly value={detail.profile.hasGhlWebhookUrl ? "Saved in setup" : ""} placeholder="Missing in setup" className="h-12 rounded-xl border-white/8 bg-black/20" /></label>
            </div>
          </Card>

          <Card className="border-white/8 bg-card/70 p-5 sm:p-7">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Settings2 className="h-5 w-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Campaign details</p><h3 className="text-xl font-extrabold">Offer and thank-you page</h3></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-extrabold">Funnel name</span><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="h-12 rounded-xl border-white/10 bg-black/15" /></label>
              <label className="space-y-2"><span className="text-sm font-extrabold">Funnel path</span><Input value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} className="h-12 rounded-xl border-white/10 bg-black/15 font-mono text-sm" /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-extrabold">Offer headline</span><Input value={form.offerHeadline} onChange={event => setForm({ ...form, offerHeadline: event.target.value })} className="h-12 rounded-xl border-white/10 bg-black/15 text-base" /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-extrabold">Offer subheadline</span><Textarea value={form.offerSubheadline} onChange={event => setForm({ ...form, offerSubheadline: event.target.value })} className="min-h-24 rounded-xl border-white/10 bg-black/15 text-base" /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-extrabold">Thank-you page message</span><Textarea value={form.thankYouMessage} onChange={event => setForm({ ...form, thankYouMessage: event.target.value })} className="min-h-24 rounded-xl border-white/10 bg-black/15 text-base" /></label>
            </div>
          </Card>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Survey builder</p><h3 className="mt-1 text-2xl font-extrabold">Questions</h3><p className="mt-1 text-sm font-medium text-muted-foreground">Drag to reorder. The customer sees one question per step.</p></div>
              <Button type="button" onClick={() => setForm({ ...form, questions: [...form.questions, { localKey: crypto.randomUUID(), questionText: "", questionType: "radio", options: ["Option 1", "Option 2"] }] })} className="h-11 gap-2 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"><Plus className="h-4 w-4" /> Add question</Button>
            </div>
            <div className="mt-4 space-y-3">
              {form.questions.length ? form.questions.map((question, index) => (
                <QuestionEditor key={question.localKey} question={question} index={index} total={form.questions.length} dragging={draggedIndex === index} onDragStart={() => setDraggedIndex(index)} onDragEnd={() => setDraggedIndex(null)} onDrop={() => { if (draggedIndex !== null) moveQuestion(draggedIndex, index); setDraggedIndex(null); }} onChange={next => setForm({ ...form, questions: form.questions.map((item, currentIndex) => currentIndex === index ? next : item) })} onRemove={() => setForm({ ...form, questions: form.questions.filter((_, currentIndex) => currentIndex !== index) })} onMove={direction => moveQuestion(index, index + direction)} />
              )) : <div className="rounded-2xl border border-dashed border-white/10 bg-card/45 p-8 text-center"><p className="font-extrabold">No survey questions</p><p className="mt-1 text-sm font-medium text-muted-foreground">The funnel will go from ZIP directly to contact.</p></div>}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-white/8 bg-card/70 p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Live preview</p><h3 className="mt-1 text-lg font-extrabold">Funnel flow</h3></div><span className="rounded-xl bg-cyan-400/10 px-3 py-2 text-sm font-extrabold text-cyan-300">{funnelStepCount(form.questions.length)} steps</span></div>
            <div className="mt-4"><FlowPreview questions={form.questions} /></div>
          </Card>

          <Card className="border-white/8 bg-card/70 p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Generated file</p><h3 className="mt-1 text-lg font-extrabold">funnel.config.ts</h3></div><Code2 className="h-5 w-5 text-cyan-300" /></div>
            {generatedConfig ? (
              <>
                <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-white/8 bg-[#061019] p-4 text-xs leading-relaxed text-cyan-50/80">{generatedConfig}</pre>
                <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(generatedConfig); toast.success("Config copied."); }} className="mt-3 h-11 w-full gap-2 rounded-xl border-white/10 bg-white/[0.025] font-extrabold"><Clipboard className="h-4 w-4" /> Copy config</Button>
              </>
            ) : hasGeneratedConfig ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
                <Code2 className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-extrabold">Saved config available</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">Copy to reveal funnel.config.ts for this funnel only.</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={exportMutation.isPending}
                  onClick={async () => {
                    const exported = await exportMutation.mutateAsync({ clientId, funnelId });
                    setExportedConfig(exported.contents);
                    await navigator.clipboard.writeText(exported.contents);
                    toast.success("Config copied.");
                  }}
                  className="mt-3 h-11 w-full gap-2 rounded-xl border-white/10 bg-white/[0.025] font-extrabold"
                >
                  <Clipboard className="h-4 w-4" /> Copy config
                </Button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/15 p-6 text-center"><Code2 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-extrabold">No config generated yet</p><p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">Save this funnel to generate the copyable TypeScript config.</p></div>
            )}
          </Card>
        </aside>
      </section>

      <div className="sticky bottom-20 z-30 rounded-2xl border border-white/10 bg-[rgba(8,15,24,0.94)] p-3 shadow-[0_20px_55px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:bottom-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="hidden text-sm font-bold text-muted-foreground sm:block">{form.questions.length} survey question{form.questions.length === 1 ? "" : "s"} · {funnelFormStepCount(form.questions.length)} form steps · {funnelStepCount(form.questions.length)} pages including Thank You</p><div className="grid grid-cols-2 gap-2"><Button type="button" disabled={busy} onClick={save} variant="outline" className="h-11 gap-2 rounded-xl border-white/10 bg-white/[0.03] px-3 text-xs font-extrabold sm:px-4 sm:text-sm"><Save className="h-4 w-4" /><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save & Generate</span></Button><Button type="button" disabled={busy || status === "deployed"} onClick={requestDeploy} className="h-11 gap-2 rounded-xl bg-cyan-400 px-3 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 sm:px-4 sm:text-sm"><Send className="h-4 w-4" /> Deploy Funnel</Button></div></div>
      </div>
    </div>
  );
}

export { DEPLOY_SUCCESS_MESSAGE };
