import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Building2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { StatusDot } from "./StatusDot";
import type { OperationalSummary } from "@shared/operationalSummary";

type ClientCardProps = {
  id: number;
  businessName: string;
  shortName: string;
  operationalSummary: OperationalSummary;
};

function toneForStatus(status: OperationalSummary["status"]): "green" | "yellow" | "red" {
  if (status === "live" || status === "ready_to_publish") return "green";
  if (status === "issue") return "red";
  return "yellow";
}

export function ClientCard({
  id,
  businessName,
  shortName,
  operationalSummary,
}: ClientCardProps) {
  const [, setLocation] = useLocation();
  const tone = toneForStatus(operationalSummary.status);

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
          <StatusDot
            good={tone === "green"}
            tone={tone}
            label={operationalSummary.statusLabel}
            compact
          />
        </div>

        <ul className="mt-6 space-y-2">
          {operationalSummary.items.map(item => (
            <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{item.label}</span>
              <span className={item.complete ? "font-bold text-emerald-300" : "font-bold text-muted-foreground"}>
                {item.complete ? "Done" : "Open"}
              </span>
            </li>
          ))}
        </ul>

        {operationalSummary.liveUrl ? (
          <a
            href={operationalSummary.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-300"
          >
            Live site
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
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
