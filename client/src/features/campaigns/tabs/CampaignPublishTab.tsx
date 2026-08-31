import { Checklist, ChecklistItem } from "@/components/dashboard/Checklist";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import type { SimpleFormPublishStatusView } from "@shared/simpleFormPublish";
import { AlertCircle, ExternalLink, Loader2, Rocket } from "lucide-react";
import { Link } from "wouter";
import { Section } from "../campaignFields";
import type { CampaignBlockerGroups } from "../campaignSteps";
import { CAMPAIGN_TAB_LABELS, type CampaignTab } from "../campaignTabs";
import { publishProgressPercent, publishStepLabel } from "../publishControl";

/**
 * Publishing is blocked by two different kinds of work, and pretending they are
 * one list is what made the old tracking step claim work it could not do.
 * Campaign fields are fixed here; the client profile is fixed once, elsewhere.
 */
export function CampaignPublishTab({
  clientId,
  slug,
  blockers,
  configurationReady,
  publish,
  publishAction,
  publishBusy,
  onOpenStep,
  onPublish,
  onRetry,
}: {
  clientId: number;
  slug: string;
  blockers: CampaignBlockerGroups;
  configurationReady: boolean;
  publish: SimpleFormPublishStatusView | null;
  publishAction: "Publish" | "Retry" | null;
  publishBusy: boolean;
  onOpenStep: (tab: CampaignTab) => void;
  onPublish: () => void;
  onRetry: () => void;
}) {
  const progress = publish?.progress ?? { completed: 0, total: 9 };
  const pages = [`/${slug}`, `/${slug}/contact`, `/${slug}/thank-you`];

  return (
    <div className="space-y-4">
      {blockers.campaign.length ? (
        <PanelCard
          title="Fix in this campaign"
          description="Fields this editor owns."
          bodyClassName="p-0"
        >
          <Checklist>
            {blockers.campaign.map(({ section, step }) => (
              <ChecklistItem
                key={section.key}
                state="fail"
                label={section.label}
                items={section.missing}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-semibold"
                    onClick={() => onOpenStep(step)}
                  >
                    {CAMPAIGN_TAB_LABELS[step]}
                  </Button>
                }
              />
            ))}
          </Checklist>
        </PanelCard>
      ) : null}

      {blockers.clientSetup.length ? (
        <PanelCard
          title="Fix in client setup"
          description="Shared across every campaign for this client, so it is set once."
          action={
            <Button asChild type="button" variant="outline" size="sm" className="h-8 text-xs font-semibold">
              <Link href={workspaceRoute("integrations", clientId)}>Open integrations</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <Checklist>
            {blockers.clientSetup.map(section => (
              <ChecklistItem
                key={section.key}
                state="fail"
                label={section.label}
                items={section.missing}
              />
            ))}
          </Checklist>
        </PanelCard>
      ) : null}

      <Section title="Publish">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {publish
              ? `${publishStepLabel(publish.step)} · ${progress.completed} of ${progress.total} steps`
              : configurationReady
                ? "Ready to publish."
                : "Clear the work above to publish."}
          </p>
          {publishAction ? (
            <Button
              type="button"
              size="sm"
              disabled={publishBusy || (publishAction === "Publish" && !configurationReady)}
              onClick={publishAction === "Publish" ? onPublish : onRetry}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {publishBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {publishAction}
            </Button>
          ) : null}
        </div>

        {publish ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${publishProgressPercent(progress)}%` }}
            />
          </div>
        ) : null}

        {publish?.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.05] p-3 text-xs leading-relaxed text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{publish.error}</span>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Three pages go live:{" "}
          {pages.map((page, index) => (
            <span key={page}>
              {index > 0 ? ", " : ""}
              <span className="font-mono">{page}</span>
            </span>
          ))}
        </p>

        {publish?.repositoryUrl || publish?.liveUrl ? (
          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            {publish.repositoryUrl ? (
              <a
                href={publish.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
              >
                Repository
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {publish.liveUrl ? (
              <a
                href={publish.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-success hover:underline"
              >
                Live campaign
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
