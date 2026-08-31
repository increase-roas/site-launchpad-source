import { EmptyPanelState, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusPill } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/app/ClientDirectory";
import {
  buildWizard,
  wizardProgress,
  type WizardStepState,
  type WizardStepStatus,
} from "@/app/wizard";
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
import { clientDestinationRoute } from "@/lib/workspaceNavigation";
import { cn } from "@/lib/utils";
import { summarizeHomepageSections } from "@shared/astroConfig";
import {
  describeBasicTabGap,
  describeTabGap,
  isBasicTabComplete,
  summarizeAstroConfigReadiness,
} from "@shared/astroConfigReadiness";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  ExternalLink,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";

/**
 * Orientation only: who the client is, where they stand, what to do next, and a
 * map into the tab that owns each step. Item-by-item readiness lives on Launch.
 */

type StepStyle = {
  icon: LucideIcon;
  note: string;
  card: string;
  chip: string;
  iconColor: string;
};

const STEP_STYLES: Record<WizardStepState, StepStyle> = {
  complete: {
    icon: CheckCircle2,
    note: "Complete",
    card: "border-success/30 bg-success/[0.04] hover:bg-success/[0.08]",
    chip: "bg-success/15 text-success",
    iconColor: "text-success",
  },
  current: {
    icon: CircleDot,
    note: "Next up",
    card: "border-primary bg-primary/[0.06] hover:bg-primary/[0.1]",
    chip: "bg-primary text-primary-foreground",
    iconColor: "text-primary",
  },
  todo: {
    icon: AlertCircle,
    note: "Needs attention",
    card: "border-warning/35 bg-warning/[0.05] hover:bg-warning/[0.1]",
    chip: "bg-warning/15 text-warning",
    iconColor: "text-warning",
  },
  unknown: {
    icon: CircleDashed,
    note: "Not checked yet",
    card: "border-border bg-card hover:bg-muted",
    chip: "bg-muted text-muted-foreground",
    iconColor: "text-muted-foreground",
  },
};

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
  const config = astroConfigQuery.data?.input;
  const configReadiness = config
    ? summarizeAstroConfigReadiness(config, astroConfigQuery.data?.assets)
    : undefined;
  const wizard = buildWizard({
    operationalSummary: summary,
    enabledSectionCount: config
      ? summarizeHomepageSections(config.homepageSections).enabled
      : undefined,
    funnelCount: workspaceQuery.data?.funnels.length,
    basicSetup: configReadiness
      ? {
          complete: isBasicTabComplete(configReadiness),
          blockedBy: describeBasicTabGap(configReadiness),
        }
      : undefined,
    brandSetup: configReadiness
      ? {
          complete: configReadiness.tabs.branding.state === "complete",
          blockedBy: describeTabGap(configReadiness, "branding"),
        }
      : undefined,
    mediaSetup: configReadiness
      ? {
          complete: configReadiness.tabs.media.state === "complete",
          blockedBy: describeTabGap(configReadiness, "media"),
        }
      : undefined,
  });
  const progress = wizardProgress(wizard);
  const action = nextClientAction(summary);
  const outstanding = wizard.filter(
    step => step.state === "todo" || step.state === "current",
  ).length;
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
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="launchpad-panel rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Build progress</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold leading-none tabular-nums">
              {progress.percent}%
            </span>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {progress.complete} of {progress.total} steps
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${progress.percent}% complete`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {outstanding === 0
              ? "Every tracked step is done."
              : `${outstanding} step${outstanding === 1 ? "" : "s"} still outstanding.`}
          </p>
        </section>

        <section className="launchpad-panel rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Recommended next step
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{action.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {action.detail}
              </p>
            </div>
            <Button asChild size="sm" className="h-9 shrink-0 text-xs font-semibold">
              <Link href={clientDestinationRoute(action.destination, clientId)}>
                Continue
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <PanelCard
        title="Build path"
        description="Each step opens the tab that owns it."
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {wizard.map(step => (
            <StepTile key={step.step} step={step} clientId={clientId} />
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

function Separator() {
  return <span aria-hidden="true">·</span>;
}

function StepTile({
  step,
  clientId,
}: {
  step: WizardStepStatus;
  clientId: number;
}) {
  const style = STEP_STYLES[step.state];
  const Icon = style.icon;

  return (
    <Link
      href={wizardStepHref(step.step, clientId)}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 transition-colors",
        style.card,
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold",
          style.chip,
        )}
      >
        {step.index}
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">
          {step.label}
        </span>
        <span className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
          <Icon
            className={cn("mt-px h-3.5 w-3.5 shrink-0", style.iconColor)}
            aria-hidden="true"
          />
          <span className="min-w-0">{step.blockedBy ?? style.note}</span>
        </span>
      </span>
    </Link>
  );
}
