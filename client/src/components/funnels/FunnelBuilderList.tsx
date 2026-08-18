import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { funnelFormStepCount } from "@shared/funnelConfig";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Rocket,
  Route,
} from "lucide-react";
import { toast } from "sonner";

type FunnelCard = inferRouterOutputs<AppRouter>["funnelBuilder"]["list"][number];
type TemplateCard = inferRouterOutputs<AppRouter>["simpleForm"]["listTemplates"][number];

const STATUS_STYLE = {
  draft: {
    label: "Draft",
    tone: "yellow" as const,
    icon: Clock3,
    className: "border-amber-300/18 bg-amber-300/[0.07] text-amber-200",
  },
  ready: {
    label: "Configuration ready",
    tone: "yellow" as const,
    icon: Rocket,
    className: "border-cyan-300/18 bg-cyan-300/[0.07] text-cyan-200",
  },
  deployed: {
    label: "Published",
    tone: "green" as const,
    icon: CheckCircle2,
    className: "border-emerald-300/18 bg-emerald-300/[0.07] text-emerald-300",
  },
};

function FunnelCardView({ funnel, onEdit }: { funnel: FunnelCard; onEdit: () => void }) {
  const status = STATUS_STYLE[funnel.deploymentStatus];
  const StatusIcon = status.icon;
  const isSimpleForm = funnel.templateKey === "simple-form";

  return (
    <button type="button" onClick={onEdit} className="group text-left">
      <Card className="h-full overflow-hidden border-white/8 bg-card/70 p-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-cyan-300/25 group-hover:shadow-[0_20px_45px_rgba(0,0,0,0.24)]">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,0.12),transparent_42%),rgba(9,17,27,0.6)] p-5">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/12">
              <Route className="h-5 w-5" />
            </span>
            <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold ${status.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>
          </div>
          <h3 className="mt-4 text-xl font-extrabold tracking-tight">{funnel.name}</h3>
          <p className="mt-1 text-sm font-bold text-cyan-300">/{funnel.slug}</p>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-relaxed text-muted-foreground">
            {isSimpleForm
              ? "ZIP → Contact → Thank You · 5 inventory slots"
              : funnel.offerHeadline || "Open this funnel to finish the offer and generate its configuration."}
          </p>
        </div>
        <div className="p-5">
          {isSimpleForm ? (
            <p className="text-sm font-bold text-muted-foreground">Simple Form Funnel</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.035] p-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Questions</p>
                <p className="mt-1 text-lg font-extrabold">{funnel.questionCount}</p>
              </div>
              <div className="rounded-xl bg-white/[0.035] p-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Steps</p>
                <p className="mt-1 text-lg font-extrabold">{funnelFormStepCount(funnel.questionCount)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.035] p-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Config</p>
                <StatusDot
                  good={funnel.hasGeneratedConfig}
                  label={funnel.hasGeneratedConfig ? "Saved" : "Needed"}
                  compact
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm font-extrabold text-cyan-300">
            Open funnel
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Card>
    </button>
  );
}

function TemplateCardView({
  template,
  creating,
  onCreate,
  onOpen,
}: {
  template: TemplateCard;
  creating: boolean;
  onCreate: () => void;
  onOpen: () => void;
}) {
  const exists = template.existingFunnelId != null;
  return (
    <Card className="overflow-hidden border-white/8 bg-card/70 p-0">
      <img
        src={template.previewImageUrl}
        alt={`${template.name} preview`}
        className="aspect-[16/9] w-full object-cover"
      />
      <div className="p-5">
        <h3 className="text-xl font-extrabold tracking-tight">{template.name}</h3>
        <p className="mt-2 text-sm font-bold text-cyan-300">{template.flow}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{template.inventory}</p>
        {exists ? (
          <Button
            type="button"
            onClick={onOpen}
            className="mt-5 h-12 w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            Already exists → Open Funnel
          </Button>
        ) : (
          <Button
            type="button"
            disabled={creating}
            onClick={onCreate}
            className="mt-5 h-12 w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Create From Template
          </Button>
        )}
      </div>
    </Card>
  );
}

export function FunnelBuilderList({
  clientId,
  onEdit,
}: {
  clientId: number;
  onEdit: (funnelId: number) => void;
}) {
  const utils = trpc.useUtils();
  const listQuery = trpc.funnelBuilder.list.useQuery({ clientId });
  const templatesQuery = trpc.simpleForm.listTemplates.useQuery({ clientId });
  const createFromTemplate = trpc.simpleForm.createFromTemplate.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.funnelBuilder.list.invalidate({ clientId }),
        utils.simpleForm.listTemplates.invalidate({ clientId }),
        utils.workspace.get.invalidate({ clientId }),
      ]);
      if (result.alreadyExists) {
        toast.message("Already exists");
      } else {
        toast.success("Simple Form Funnel created.");
      }
      onEdit(result.funnelId);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Existing Client Funnels</p>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Funnels this client already has</h2>
        </div>
        {listQuery.isLoading ? (
          <div className="grid min-h-44 place-items-center rounded-3xl border border-white/8 bg-card/50">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
          </div>
        ) : listQuery.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm font-bold text-red-200">
            {listQuery.error.message}
          </div>
        ) : (listQuery.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-card/40 p-6 text-sm font-medium text-muted-foreground">
            No funnels yet. Create one from a template below.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(listQuery.data ?? []).map(funnel => (
              <FunnelCardView key={funnel.id} funnel={funnel} onEdit={() => onEdit(funnel.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Available Templates</p>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Create from an approved funnel</h2>
        </div>
        {templatesQuery.isLoading ? (
          <div className="grid min-h-44 place-items-center rounded-3xl border border-white/8 bg-card/50">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
          </div>
        ) : templatesQuery.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm font-bold text-red-200">
            {templatesQuery.error.message}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(templatesQuery.data ?? []).map(template => (
              <TemplateCardView
                key={template.templateKey}
                template={template}
                creating={createFromTemplate.isPending}
                onOpen={() => template.existingFunnelId && onEdit(template.existingFunnelId)}
                onCreate={() =>
                  createFromTemplate.mutate({ clientId, templateKey: "simple-form" })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
