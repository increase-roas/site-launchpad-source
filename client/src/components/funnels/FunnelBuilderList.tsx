import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { funnelFormStepCount } from "@shared/funnelConfig";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Rocket,
  Route,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type FunnelCard = inferRouterOutputs<AppRouter>["funnelBuilder"]["list"][number];

const STATUS_STYLE = {
  draft: {
    label: "Draft",
    tone: "yellow" as const,
    icon: Clock3,
    className: "border-amber-300/18 bg-amber-300/[0.07] text-amber-200",
  },
  ready: {
    label: "Ready",
    tone: "yellow" as const,
    icon: Rocket,
    className: "border-cyan-300/18 bg-cyan-300/[0.07] text-cyan-200",
  },
  deployed: {
    label: "Deployed",
    tone: "green" as const,
    icon: CheckCircle2,
    className: "border-emerald-300/18 bg-emerald-300/[0.07] text-emerald-200",
  },
};

function FunnelCardView({ funnel, onEdit }: { funnel: FunnelCard; onEdit: () => void }) {
  const status = STATUS_STYLE[funnel.deploymentStatus];
  const StatusIcon = status.icon;

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
            {funnel.offerHeadline || "Open this funnel to finish the offer and generate its configuration."}
          </p>
        </div>

        <div className="p-5">
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
          <div className="mt-4 flex items-center justify-between text-sm font-extrabold text-cyan-300">
            Edit funnel
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Card>
    </button>
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
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const createMutation = trpc.funnelBuilder.create.useMutation({
    onSuccess: async detail => {
      await Promise.all([
        utils.funnelBuilder.list.invalidate({ clientId }),
        utils.workspace.get.invalidate({ clientId }),
      ]);
      setCreateOpen(false);
      setName("");
      toast.success("Funnel created from the client profile.");
      onEdit(detail.funnel.id);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Funnel campaigns</p>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">Create and manage funnels</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Every funnel keeps its own offer, survey questions, generated config, and deployment status.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-12 gap-2 rounded-xl bg-cyan-400 px-5 font-extrabold text-slate-950 hover:bg-cyan-300"
        >
          <Plus className="h-5 w-5" />
          Create Funnel
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="grid min-h-44 place-items-center rounded-3xl border border-white/8 bg-card/50">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">Loading funnels…</p>
          </div>
        </div>
      ) : listQuery.error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm font-bold text-red-200">
          {listQuery.error.message}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(listQuery.data ?? []).map(funnel => (
            <FunnelCardView key={funnel.id} funnel={funnel} onEdit={() => onEdit(funnel.id)} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold">Create a funnel</DialogTitle>
            <DialogDescription className="font-medium leading-relaxed">
              Give it a clear campaign name. Client details and setup values will fill automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-extrabold">Funnel name</span>
              <Input
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && name.trim().length >= 2) {
                    event.preventDefault();
                    createMutation.mutate({ clientId, name: name.trim() });
                  }
                }}
                placeholder="Hot Tub Quiz"
                className="h-13 rounded-xl border-white/10 bg-white/[0.035] text-base"
              />
            </label>
            <Button
              type="button"
              disabled={name.trim().length < 2 || createMutation.isPending}
              onClick={() => createMutation.mutate({ clientId, name: name.trim() })}
              className="h-13 w-full gap-2 rounded-xl bg-cyan-400 text-base font-extrabold text-slate-950 hover:bg-cyan-300"
            >
              {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Create and open
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
