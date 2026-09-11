import { EmptyPanelState, PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusPill } from "@/components/dashboard/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientAvatar } from "@/app/ClientDirectory";
import { buildWizard, wizardProgress } from "@/app/wizard";
import { wizardStepHref } from "@/app/wizardRoutes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import {
  clientSiteHost,
  clientStatusTone,
  clientThemeLabel,
  formatClientUpdatedAt,
  nextClientAction,
} from "@/lib/clientBoard";
import { clientDestinationRoute, workspaceRoute } from "@/lib/workspaceNavigation";
import { BuildPath } from "./BuildPath";
import { buildOverviewWizardSignals } from "./overviewWizard";
import { ArrowRight, CircleDot, ExternalLink, KeyRound, ListChecks, UsersRound } from "lucide-react";
import { Link } from "wouter";

/**
 * Orientation only: who the client is, where they stand, what to do next, and a
 * map into the tab that owns each step. Item-by-item readiness lives on Launch.
 */

export default function ClientOverviewPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });
  const astroConfigQuery = trpc.astroConfig.get.useQuery({ clientId });

  if (!selectedClient) {
    return (
      <EmptyPanelState
        icon={<UsersRound className="h-5 w-5" />}
        title="Choose a client"
        description="Pick a client from the switcher to see what is finished and what still needs attention."
        action={
          <Button asChild size="sm" className="h-8 text-xs font-semibold">
            <Link href="/clients">All clients</Link>
          </Button>
        }
      />
    );
  }

  const { client } = selectedClient;
  const summary = selectedClient.operationalSummary;
  const configLoading = astroConfigQuery.isLoading;
  const wizard = buildWizard(
    buildOverviewWizardSignals({
      operationalSummary: summary,
      config: astroConfigQuery.data?.input,
      assets: astroConfigQuery.data?.assets,
      secretStatus: astroConfigQuery.data?.secretStatus,
      funnelCount: workspaceQuery.data?.funnels.length,
    }),
  );
  const progress = wizardProgress(wizard);
  const current = wizard.find(step => step.state === "current");
  const listAction = nextClientAction(summary);
  const action = current
    ? {
        label: current.label,
        detail: current.blockedBy ?? current.caption,
        href: wizardStepHref(current.step, clientId),
      }
    : {
        label: listAction.label,
        detail: listAction.detail,
        href: clientDestinationRoute(listAction.destination, clientId),
      };
  const outstanding = wizard.filter(
    step => step.state === "todo" || step.state === "current",
  ).length;
  const unchecked = wizard.some(step => step.state === "unknown");
  const allDone = outstanding === 0 && !unchecked;
  const themeLabel = clientThemeLabel(client.theme);
  const siteHost = clientSiteHost(summary.liveUrl);

  return (
    <div className="space-y-3">
      <section className="launchpad-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-4">
        <ClientAvatar
          name={client.businessName}
          className="h-11 w-11 text-sm"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {client.businessName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{client.shortName}</span>
            {themeLabel ? (
              <>
                <Separator />
                <span>{themeLabel} theme</span>
              </>
            ) : null}
            <Separator />
            <span>Updated {formatClientUpdatedAt(client.updatedAt)}</span>
          </p>
        </div>

        <StatusPill
          tone={clientStatusTone(summary.status)}
          label={summary.statusLabel}
        />

        {summary.liveUrl ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <a href={summary.liveUrl} target="_blank" rel="noreferrer">
              <span className="max-w-[16rem] truncate">
                {siteHost ?? "Open live site"}
              </span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <span className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Not published yet
          </span>
        )}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs font-semibold"
        >
          <Link href={workspaceRoute("inventory", clientId)}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Inventory
          </Link>
        </Button>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {configLoading ? (
          <>
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </>
        ) : (
          <>
            <StatCard
              label="Build progress"
              value={`${progress.percent}%`}
              icon={ListChecks}
              tone={allDone ? "success" : "primary"}
              note={
                allDone
                  ? "Every tracked step is done."
                  : `${progress.complete} of ${progress.total} steps · ${outstanding} outstanding`
              }
              noteTone={allDone ? "success" : undefined}
              progress={progress.percent}
            />

            <Alert className="bg-card">
              <CircleDot />
              <AlertTitle>Recommended next step</AlertTitle>
              <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-medium text-foreground">{action.label}</span>
                  <span className="mt-0.5 block text-xs">{action.detail}</span>
                </span>
                <Button asChild size="sm" className="h-9 shrink-0 text-xs font-semibold">
                  <Link href={action.href}>
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>

      <PanelCard
        title="Build path"
        description="Each step is scored from the current configuration and opens the tab that owns it."
      >
        <BuildPath
          steps={wizard}
          clientId={clientId}
          loading={configLoading}
        />
      </PanelCard>
    </div>
  );
}

function Separator() {
  return <span aria-hidden="true">·</span>;
}
