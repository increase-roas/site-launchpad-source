import { DeferredNotice } from "@/components/dashboard/DeferredNotice";
import { EmptyPanelState, PageHeading, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusPill } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { buildWizard, wizardProgress } from "@/app/wizard";
import {
  clientStatusTone,
  CLIENT_STATUS_ORDER,
  type ClientBoardItem,
} from "@/lib/clientBoard";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

/**
 * Launchpad does not persist an event timeline, so this is a live snapshot: what
 * each client is currently blocked on, ordered by urgency. The historical feed the
 * design implies needs an audit store that does not exist yet.
 */
export default function ActivityPage() {
  const { clients, isLoading, isError } = useWorkspace();

  const ranked = [...clients].sort(
    (a, b) =>
      CLIENT_STATUS_ORDER.indexOf(
        a.operationalSummary.status as (typeof CLIENT_STATUS_ORDER)[number],
      ) -
      CLIENT_STATUS_ORDER.indexOf(
        b.operationalSummary.status as (typeof CLIENT_STATUS_ORDER)[number],
      ),
  );

  return (
    <div className="space-y-4">
      <PageHeading
        title="Activity"
        description="What every client is working through right now."
      />

      <PanelCard
        title="Current state by client"
        description="Ordered by how much attention each client needs."
        bodyClassName="p-0"
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : isError ? (
          <p className="p-4 text-xs text-muted-foreground">
            Clients could not be loaded.
          </p>
        ) : ranked.length === 0 ? (
          <EmptyPanelState
            title="No clients yet"
            description="Activity appears once a client exists."
            action={
              <Button asChild size="sm" className="h-8 text-xs font-semibold">
                <Link href="/clients/new">Add client</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {ranked.map((item: ClientBoardItem) => {
              const wizard = buildWizard({
                operationalSummary: item.operationalSummary,
              });
              const progress = wizardProgress(wizard);
              const current = wizard.find(step => step.state === "current");

              return (
                <li key={item.client.id}>
                  <Link
                    href={workspaceRoute("overview", item.client.id)}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {item.client.businessName}
                        </p>
                        <StatusPill
                          tone={clientStatusTone(item.operationalSummary.status)}
                          label={item.operationalSummary.statusLabel}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {current
                          ? `Step ${current.index} · ${current.label}${
                              current.blockedBy ? ` — ${current.blockedBy}` : ""
                            }`
                          : "All tracked steps complete"}
                      </p>
                    </div>

                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {progress.complete}/{progress.total} steps
                      </p>
                    </div>

                    {progress.complete === progress.total ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                    ) : null}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <DeferredNotice
        title="No historical timeline yet"
        reason="Runtime operations are emitted to server logs but are not persisted to a queryable store, so past events cannot be listed here."
        planned={[
          "Chronological feed of configuration changes, publishes, and promotions",
          "Actor attribution for every recorded action",
          "Filtering by client, environment, and outcome",
        ]}
      />
    </div>
  );
}
