import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activeWizardSteps } from "@/app/wizard";
import { wizardStepHref } from "@/app/wizardRoutes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import { configurationRoute } from "@/lib/workspaceNavigation";
import {
  ASTRO_SECTION_DESCRIPTIONS,
  ASTRO_SECTION_LABELS,
  summarizeHomepageSections,
} from "@shared/astroConfig";
import { summarizeAstroConfigReadiness } from "@shared/astroConfigReadiness";
import {
  buildSiteMap,
  buildSiteMapMetrics,
  pageStateLabel,
  pageStateTone,
} from "./pagesModel";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LayoutList,
  Lightbulb,
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

/**
 * Read-only site map. Every page and its state is derived from the Astro
 * configuration that publishes, and each row links to the configuration surface
 * that owns its content, so this screen never becomes a second place to edit.
 */
export default function PagesManagerPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const astroConfigQuery = trpc.astroConfig.get.useQuery({ clientId });
  const [showTips, setShowTips] = useState(false);

  const summary = selectedClient?.operationalSummary;
  const published = Boolean(
    summary?.items.find(item => item.key === "websiteLive")?.complete,
  );

  const config = astroConfigQuery.data?.input;
  const assets = astroConfigQuery.data?.assets;

  const pages = useMemo(() => {
    if (!config) return [];
    return buildSiteMap({
      clientId,
      config,
      readiness: summarizeAstroConfigReadiness(config, assets ?? []),
      published,
    });
  }, [clientId, config, assets, published]);

  if (astroConfigQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  if (astroConfigQuery.isError || !config) {
    return (
      <div className="launchpad-panel rounded-lg p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">Pages could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {astroConfigQuery.error?.message ??
            "This client's website configuration is unavailable."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => astroConfigQuery.refetch()}
          className="mt-4 h-8 text-xs font-semibold"
        >
          Try again
        </Button>
      </div>
    );
  }

  const metrics = buildSiteMapMetrics(pages);
  const sections = summarizeHomepageSections(config.homepageSections);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Template pages"
          value={metrics.total}
          icon={FileText}
          tone="primary"
          note={`${metrics.publishable} publish for this client`}
        />
        <StatCard
          label={published ? "Live" : "Ready to publish"}
          value={metrics.live + metrics.ready}
          icon={CheckCircle2}
          tone="success"
          note={`${metrics.readyPercent}% of publishing pages`}
          progress={metrics.readyPercent}
        />
        <StatCard
          label="Needs attention"
          value={metrics.attention}
          icon={AlertTriangle}
          tone="warning"
          note={metrics.attention === 0 ? "Nothing outstanding" : "Open the owning tab to fix"}
        />
        <StatCard
          label="Homepage sections"
          value={`${sections.enabled} of ${sections.total}`}
          icon={LayoutList}
          tone="neutral"
          note="Visible on /"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          The template fixes which pages exist. Configuration decides what they say.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowTips(value => !value)}
          className="ml-auto h-9 gap-1.5 text-xs font-semibold"
          aria-pressed={showTips}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
          {showTips ? "Hide tips" : "Show tips"}
        </Button>
      </div>

      {showTips ? (
        <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-4">
          <p className="text-sm font-semibold text-primary">How pages work</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>
              Pages come from the site template, so there is no free-form page
              creation. This screen reports them; it does not edit them.
            </li>
            <li>
              Every state is read from the configuration that publishes. Use the
              action on each row to edit the content that page renders.
            </li>
            <li>
              Off means the template will not publish that page for this client,
              usually because the categories or financing behind it are turned off.
            </li>
            <li>
              Live appears only after the website has been published from Launch.
            </li>
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PanelCard title="Site map" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Page
                </TableHead>
                <TableHead className="w-36 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What it needs
                </TableHead>
                <TableHead className="w-56 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Owned by
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map(page => (
                <TableRow key={page.id} className="border-border">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <FileText
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{page.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {page.slug}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <StatusBadge
                      tone={pageStateTone(page.state)}
                      label={pageStateLabel(page.state)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    {page.detail}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      <Link href={page.ownerHref}>
                        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {page.ownerLabel}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>

        <PanelCard
          title="Homepage"
          description="The order the template renders, top to bottom."
          action={
            <StatusBadge tone="success" label={`${sections.enabled} visible`} />
          }
          bodyClassName="p-2"
        >
          <ul className="space-y-0.5">
            {config.homepageSections.map(section => (
              <li
                key={section.id}
                className="flex items-center gap-2 rounded-lg px-2 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {ASTRO_SECTION_LABELS[section.type]}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ASTRO_SECTION_DESCRIPTIONS[section.type]}
                  </p>
                </div>
                <StatusBadge
                  tone={section.enabled ? "success" : "neutral"}
                  label={section.enabled ? "Visible" : "Hidden"}
                />
              </li>
            ))}
          </ul>
          <div className="px-2 pb-1 pt-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs font-semibold"
            >
              <Link href={configurationRoute(clientId, "content")}>
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                Edit homepage sections
              </Link>
            </Button>
          </div>
        </PanelCard>
      </div>

      <NextInBuild clientId={clientId} />
    </div>
  );
}

function NextInBuild({ clientId }: { clientId: number }) {
  const steps = activeWizardSteps();
  const position = steps.findIndex(step => step.step === "pages");
  const pagesStep = position < 0 ? undefined : steps[position];
  const nextStep = position < 0 ? undefined : steps[position + 1];

  return (
    <PanelCard title="Next in the build">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {pagesStep
          ? `Pages are step ${pagesStep.index} of ${steps.length}.`
          : "Pages report what the rest of the build produces."}
        {nextStep ? ` ${nextStep.label} comes next.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {nextStep ? (
          <Button asChild size="sm" className="h-8 text-xs font-semibold">
            <Link href={wizardStepHref(nextStep.step, clientId)}>
              Go to {nextStep.label.toLowerCase()}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
          <Link href={configurationRoute(clientId, "media")}>Back to media</Link>
        </Button>
      </div>
    </PanelCard>
  );
}
