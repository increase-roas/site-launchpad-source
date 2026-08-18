import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientCard } from "@/components/ClientCard";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2, Plus, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const clientsQuery = trpc.clients.list.useQuery(undefined, {
    retry: false,
  });
  const clientViews = clientsQuery.data ?? [];
  const readyCount = clientViews.filter(
    view => view.client.status === "ready" || view.client.status === "live",
  ).length;
  const needsItemsCount = clientViews.filter(view => !view.readiness.isComplete).length;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7 pb-10 sm:space-y-9 sm:p-2 lg:p-5">
      <header className="launchpad-feature-surface relative overflow-hidden rounded-3xl border p-6 sm:p-8 lg:p-10">
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300 ring-1 ring-cyan-300/15">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              Client launch board
            </div>
            <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl lg:text-5xl">
              Get every client ready to launch.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
              Open a client to see exactly what is finished and what still needs attention.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => setLocation("/clients/new")}
            className="h-14 w-full gap-2 rounded-2xl bg-cyan-400 px-6 text-base font-extrabold text-slate-950 shadow-[0_12px_35px_rgba(34,211,238,0.24)] hover:bg-cyan-300 lg:w-auto"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Add new client
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/8 bg-card/70 p-5">
          <p className="text-sm font-bold text-muted-foreground">All clients</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{clientViews.length}</p>
        </Card>
        <Card className="border-emerald-400/12 bg-emerald-400/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-300">Ready</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{readyCount}</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
        </Card>
        <Card className="border-red-400/12 bg-red-400/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-300">Needs items</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{needsItemsCount}</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-400/10 text-red-300">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
        </Card>
      </section>

      {clientsQuery.isLoading ? (
        <div className="grid min-h-[340px] place-items-center rounded-3xl border border-white/8 bg-card/40">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" aria-hidden="true" />
            <p className="mt-4 text-base font-bold text-muted-foreground">Loading clients…</p>
          </div>
        </div>
      ) : clientsQuery.error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-300" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold">Clients could not be loaded</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Try again. If this keeps happening, ask Alex for help.
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => clientsQuery.refetch()}
            className="mt-5 h-12 border-white/10 bg-white/[0.025] font-extrabold"
          >
            Try again
          </Button>
        </div>
      ) : clientViews.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-card/45 px-6 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
            <UsersRound className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Add the first client</h2>
          <p className="mx-auto mt-2 max-w-md text-base font-medium leading-relaxed text-muted-foreground">
            Start with the business name. You can add the rest later.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => setLocation("/clients/new")}
            className="mt-6 h-14 rounded-2xl bg-cyan-400 px-6 text-base font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Add new client
          </Button>
        </div>
      ) : (
        <section aria-label="Clients" className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {clientViews.map(view => (
            <ClientCard
              key={view.client.id}
              id={view.client.id}
              businessName={view.client.businessName}
              shortName={view.client.shortName}
              status={view.client.status}
              readiness={view.readiness}
            />
          ))}
        </section>
      )}
    </div>
  );
}
