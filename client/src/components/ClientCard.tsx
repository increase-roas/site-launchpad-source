import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { ReadinessBar } from "./ReadinessBar";
import { StatusDot } from "./StatusDot";

type ClientCardProps = {
  id: number;
  businessName: string;
  shortName: string;
  status: "draft" | "ready" | "live" | "issue";
  readiness: {
    completed: number;
    total: number;
    percent: number;
    isComplete: boolean;
  };
};

export function ClientCard({
  id,
  businessName,
  shortName,
  status,
  readiness,
}: ClientCardProps) {
  const [, setLocation] = useLocation();
  const good = (status === "ready" || status === "live") && readiness.isComplete;
  const label = status === "live" ? "Live" : status === "ready" ? "Ready" : "Needs items";

  return (
    <Card className="group relative overflow-hidden border-white/8 bg-card/90 p-0 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/14">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500/80 via-teal-400/70 to-transparent" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-card-foreground">
                {businessName}
              </h2>
              <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">{shortName}</p>
            </div>
          </div>
          <StatusDot good={good} label={label} compact />
        </div>

        <div className="mt-6">
          <ReadinessBar
            percent={readiness.percent}
            completed={readiness.completed}
            total={readiness.total}
          />
        </div>

        {status === "ready" ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-400/8 px-3 py-2.5 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/15">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Flagged for deployment
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setLocation(`/workspace/${id}/pages`)}
          className="mt-5 h-12 w-full justify-between border-white/10 bg-white/[0.025] px-4 text-base font-extrabold hover:bg-white/[0.06]"
        >
          Open client
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </Card>
  );
}
