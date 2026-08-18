import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { integrationsRoute } from "@/lib/workspaceNavigation";
import { publicErrorMessage } from "@shared/safePublicError";
import { trpc } from "@/lib/trpc";
import { integrationPresenceRows } from "@shared/paidFunnel/integrationPresence";
import { AlertCircle, ArrowLeft, Loader2, PlugZap } from "lucide-react";
import { useLocation } from "wouter";

export default function ClientIntegrationsPage({ clientId }: { clientId: number }) {
  const [, setLocation] = useLocation();
  const query = trpc.clients.getIntegrationProfile.useQuery({ clientId });

  if (query.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center">
        <AlertCircle className="mx-auto h-9 w-9 text-red-300" />
        <h1 className="mt-4 text-2xl font-extrabold">Integrations could not be loaded</h1>
        <p className="mt-2 text-muted-foreground">{publicErrorMessage(query.error?.message, "Try again. If this keeps happening, ask Alex for help.")}</p>
      </div>
    );
  }

  const dto = query.data;
  const groups = integrationPresenceRows(dto);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <header className="rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_88%_-10%,rgba(34,211,238,0.14),transparent_35%),rgba(17,26,37,0.88)] p-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLocation(`/workspace/${clientId}/settings`)}
          className="-ml-3 h-11 gap-2 text-base font-bold text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to settings
        </Button>
        <div className="mt-3 flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/12">
            <PlugZap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Client integrations</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em]">SET / NOT SET</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
              Presence only. Secret values are never shown. Path: {integrationsRoute(clientId)}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/8 bg-card/70 p-4">
          <p className="text-xs font-bold text-muted-foreground">Website ready</p>
          <p className="mt-1 text-xl font-extrabold">{dto.readiness.websiteReady ? "SET" : "NOT SET"}</p>
        </Card>
        <Card className="border-white/8 bg-card/70 p-4">
          <p className="text-xs font-bold text-muted-foreground">Funnel ready</p>
          <p className="mt-1 text-xl font-extrabold">{dto.readiness.funnelReady ? "SET" : "NOT SET"}</p>
        </Card>
        <Card className="border-white/8 bg-card/70 p-4">
          <p className="text-xs font-bold text-muted-foreground">Reconciliation</p>
          <p className="mt-1 text-xl font-extrabold capitalize">{dto.reconciliationStatus}</p>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(group => (
          <Card key={group.id} className="border-white/8 bg-card/70 p-5">
            <h2 className="text-lg font-extrabold">{group.label}</h2>
            <ul className="mt-3 space-y-2">
              {group.fields.map(field => (
                <li key={field.key} className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="truncate text-muted-foreground">{field.key}</span>
                  <span className={field.presence === "SET" ? "text-emerald-300" : "text-red-300"}>
                    {field.presence}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
