import { Checklist, ChecklistItem } from "@/components/dashboard/Checklist";
import { Disclosure } from "@/components/dashboard/Disclosure";
import { EmptyPanelState, PageHeading, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { summarizeHomepageSections } from "@shared/astroConfig";
import { ExternalLink, Loader2, Rocket, UsersRound } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  isPublishActive,
  publishAdvanceDelayMs,
  publishPercent,
  publishPollIntervalMs,
  publishStepLabel,
} from "./astroPublishFlow";
import {
  buildLaunchChecks,
  launchBlockers,
  launchReadiness,
  type LaunchCheck,
} from "./launchChecks";

export default function LaunchPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ clientId }), [clientId]);
  const astroConfigQuery = trpc.astroConfig.get.useQuery(queryInput);
  const publishQuery = trpc.astroConfig.publishStatus.useQuery(queryInput, {
    refetchInterval: state => publishPollIntervalMs(state.state.data),
  });
  const advanceInFlightRef = useRef(false);

  const startPublishMutation = trpc.astroConfig.startPublish.useMutation({
    onSuccess: status => {
      utils.astroConfig.publishStatus.setData(queryInput, status);
      void utils.clients.list.invalidate();
      toast.success("Website publishing started.");
    },
    onError: error => toast.error(error.message),
  });
  const advancePublishMutation = trpc.astroConfig.advancePublish.useMutation({
    onSuccess: status => {
      utils.astroConfig.publishStatus.setData(queryInput, status);
      void utils.clients.list.invalidate();
      if (status.status === "published") toast.success("Website published.");
    },
    onError: error => toast.error(error.message),
    onSettled: () => {
      advanceInFlightRef.current = false;
    },
  });

  const publish = publishQuery.data;
  const advancePublish = advancePublishMutation.mutate;

  useEffect(() => {
    const delay = publishAdvanceDelayMs(publish);
    if (delay === null || advanceInFlightRef.current) return;
    const timer = window.setTimeout(() => {
      if (advanceInFlightRef.current) return;
      advanceInFlightRef.current = true;
      advancePublish({ clientId, retryFailed: false });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [advancePublish, clientId, publish]);

  if (!selectedClient) {
    return (
      <EmptyPanelState
        icon={<UsersRound className="h-5 w-5" />}
        title="Choose a client"
        description="Launch is scoped to a single client."
      />
    );
  }

  const summary = selectedClient.operationalSummary;
  const config = astroConfigQuery.data?.input;
  const checks = buildLaunchChecks({
    clientId,
    summary,
    homepageSections: config
      ? summarizeHomepageSections(config.homepageSections)
      : undefined,
  });
  const readiness = launchReadiness(checks);
  const blockers = launchBlockers(checks);
  const liveUrl = publish?.liveUrl ?? summary.liveUrl;
  const publishing = isPublishActive(publish);

  return (
    <div className="space-y-4">
      <PageHeading title="Launch" />

      {blockers.length ? (
        <PanelCard
          title="Blockers"
          action={<StatusBadge tone="warning" label={`${blockers.length} to fix`} dot />}
          bodyClassName="p-0"
        >
          <Checklist>
            {blockers.map(check => (
              <BlockerRow key={check.key} check={check} />
            ))}
          </Checklist>
        </PanelCard>
      ) : null}

      <PanelCard
        title="Website"
        action={
          publish?.status === "failed" ? (
            <Button
              type="button"
              size="sm"
              disabled={advancePublishMutation.isPending}
              onClick={() => {
                if (advanceInFlightRef.current) return;
                advanceInFlightRef.current = true;
                advancePublish({ clientId, retryFailed: true });
              }}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {advancePublishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Rocket className="h-4 w-4" aria-hidden="true" />
              )}
              Retry
            </Button>
          ) : publishing ? (
            <StatusBadge tone="info" label="Publishing" dot />
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={startPublishMutation.isPending || !readiness.ready}
              onClick={() => startPublishMutation.mutate({ clientId })}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {startPublishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Rocket className="h-4 w-4" aria-hidden="true" />
              )}
              {publish ? "Publish again" : "Publish"}
            </Button>
          )
        }
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          {publish
            ? `${publishStepLabel(publish.step)} · step ${publish.progress.completed} of ${publish.progress.total}`
            : readiness.ready
              ? "Ready to publish."
              : `Clear ${blockers.length === 1 ? "the blocker" : "the blockers"} above to publish.`}
        </p>

        {publish ? (
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${publishPercent(publish.progress)}% published`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                publish.status === "failed" ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${publishPercent(publish.progress)}%` }}
            />
          </div>
        ) : null}

        {publish?.error ? (
          <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/[0.05] p-3 text-xs leading-relaxed text-destructive">
            {publish.error}
          </p>
        ) : null}

        {publish?.repositoryUrl || liveUrl ? (
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
            {publish?.repositoryUrl ? (
              <a
                href={publish.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
              >
                Repository
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
            {liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-success hover:underline"
              >
                Live website
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}
      </PanelCard>

      <Disclosure
        title="All checks"
        meta={`${readiness.passed} of ${readiness.total} passing`}
        bodyClassName="p-0"
      >
        <Checklist>
          {checks.map(check => (
            <ChecklistItem
              key={check.key}
              state={check.state}
              label={check.label}
              detail={check.detail}
            />
          ))}
        </Checklist>
      </Disclosure>
    </div>
  );
}

function BlockerRow({ check }: { check: LaunchCheck }) {
  return (
    <ChecklistItem
      state="fail"
      label={check.label}
      detail={check.detail}
      action={
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 shrink-0 text-xs font-semibold"
        >
          <Link href={check.fixHref}>Fix</Link>
        </Button>
      }
    />
  );
}
