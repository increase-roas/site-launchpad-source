import { ClientAvatar } from "@/app/ClientDirectory";
import { Disclosure } from "@/components/dashboard/Disclosure";
import { EmptyPanelState, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusBadge, type BadgeTone } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  clientSiteHost,
  clientThemeLabel,
  formatClientUpdatedAt,
} from "@/lib/clientBoard";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { clientDeployGaps, summarizeHomepageSections } from "@shared/astroConfig";
import type {
  AstroSitePreviewHistoryItem,
  AstroSitePreviewStatusView,
} from "@shared/astroSitePreview";
import type { AstroSitePublishStatusView } from "@shared/astroSitePublish";
import {
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  Loader2,
  Rocket,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  isPreviewActive,
  previewActionLabel,
  previewPercent,
  previewStepLabel,
} from "./astroPreviewFlow";
import { useAstroPreviewJob } from "./useAstroPreviewJob";
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
  type LaunchReadiness,
} from "./launchChecks";
import {
  LAUNCH_PIPELINE_PHASE_LABELS,
  launchPipelinePhases,
  pipelinePhaseVisualState,
  previewEnvironmentKind,
  previewPipelineJobKind,
  previewPipelinePhase,
  publishEnvironmentKind,
  publishPipelineJobKind,
  publishPipelinePhase,
  type LaunchPipelinePhase,
  type PipelineJobKind,
  type PipelinePhaseVisualState,
  type PreviewEnvironmentKind,
  type PublishEnvironmentKind,
} from "./launchPipeline";

type PreviewJob = ReturnType<typeof useAstroPreviewJob>;

type NextLaunchAction = {
  label: string;
  detail: string;
  kind: "fix" | "preview" | "approve" | "publish" | "done";
  href?: string;
};

export default function LaunchPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ clientId }), [clientId]);
  const astroConfigQuery = trpc.astroConfig.get.useQuery(queryInput);
  const publishQuery = trpc.astroConfig.publishStatus.useQuery(queryInput, {
    refetchInterval: state => publishPollIntervalMs(state.state.data),
  });
  const advanceInFlightRef = useRef(false);

  const { preview, history, startPreview, approvePreview } =
    useAstroPreviewJob(clientId);
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

  const { client } = selectedClient;
  const summary = selectedClient.operationalSummary;
  const config = astroConfigQuery.data?.input;
  const checks = buildLaunchChecks({
    clientId,
    summary,
    homepageSections: config
      ? summarizeHomepageSections(config.homepageSections)
      : undefined,
    clientDeploy: config
      ? { gaps: clientDeployGaps(config, astroConfigQuery.data?.assets ?? []) }
      : undefined,
  });
  const readiness = launchReadiness(checks);
  const blockers = launchBlockers(checks);
  const liveUrl = publish?.liveUrl ?? summary.liveUrl;
  const publishing = isPublishActive(publish);
  const previewKind = previewEnvironmentKind(preview);
  const publishKind = publishEnvironmentKind(publish);
  const next = nextLaunchAction({
    readiness,
    blockers,
    previewKind,
    publishKind,
    approved: Boolean(preview?.approvedSha),
  });
  const themeLabel = clientThemeLabel(client.theme);
  const liveHost = clientSiteHost(liveUrl);

  return (
    <div className="space-y-3">
      <section className="launchpad-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-4">
        <ClientAvatar name={client.businessName} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {client.businessName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{client.shortName}</span>
            {themeLabel ? (
              <>
                <Dot />
                <span>{themeLabel} theme</span>
              </>
            ) : null}
            <Dot />
            <span>Launch</span>
            <Dot />
            <span>Updated {formatClientUpdatedAt(client.updatedAt)}</span>
          </p>
        </div>
        <StatusBadge
          tone={readinessTone(readiness)}
          label={
            readiness.ready
              ? "Ready to publish"
              : readiness.failing
                ? `${readiness.failing} blocker${readiness.failing === 1 ? "" : "s"}`
                : "Checking readiness"
          }
          dot
        />
        {liveUrl ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <span className="max-w-[16rem] truncate">
                {liveHost ?? "Open live site"}
              </span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="launchpad-panel rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Readiness</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold leading-none tabular-nums">
              {readinessPercent(readiness)}%
            </span>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {readiness.passed} of {readiness.total} checks
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${readinessPercent(readiness)}% of launch checks passing`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                readiness.ready ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${readinessPercent(readiness)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {readiness.ready
              ? "Every launch check is passing."
              : readiness.failing
                ? `${readiness.failing} item${readiness.failing === 1 ? "" : "s"} still block a clean launch.`
                : "Waiting on configuration to finish loading."}
          </p>
        </section>

        <section className="launchpad-panel rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Recommended next step
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                next.kind === "done"
                  ? "bg-success/10 text-success"
                  : next.kind === "fix"
                    ? "bg-warning/10 text-warning"
                    : "bg-primary/10 text-primary",
              )}
            >
              {next.kind === "done" ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Rocket className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{next.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {next.detail}
              </p>
            </div>
            {next.href ? (
              <Button asChild size="sm" className="h-9 shrink-0 text-xs font-semibold">
                <Link href={next.href}>Fix</Link>
              </Button>
            ) : null}
          </div>
          {blockers.length > 1 ? (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {blockers.slice(1, 4).map(check => (
                <li
                  key={check.key}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-xs font-medium">
                    {check.label}
                  </span>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs font-semibold"
                  >
                    <Link href={check.fixHref}>Fix</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <PreviewEnvironment
          clientId={clientId}
          businessName={client.businessName}
          preview={preview}
          startPreview={startPreview}
          approvePreview={approvePreview}
        />
        <ProductionEnvironment
          liveUrl={liveUrl}
          publish={publish}
          publishing={publishing}
          startPending={startPublishMutation.isPending}
          retryPending={advancePublishMutation.isPending}
          onStart={() => startPublishMutation.mutate({ clientId })}
          onRetry={() => {
            if (advanceInFlightRef.current) return;
            advanceInFlightRef.current = true;
            advancePublish({ clientId, retryFailed: true });
          }}
        />
      </div>

      {preview?.status === "ready" && preview.previewUrl ? (
        <PreviewViewport
          businessName={client.businessName}
          previewUrl={preview.previewUrl}
        />
      ) : null}

      <PanelCard
        title="Launch checks"
        description="What must be true before a production publish is clean."
        action={
          <StatusBadge
            tone={readinessTone(readiness)}
            label={`${readiness.passed} of ${readiness.total} passing`}
          />
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map(check => (
            <CheckTile key={check.key} check={check} />
          ))}
        </ul>
      </PanelCard>

      {history.length > 1 ? (
        <Disclosure
          title="Preview history"
          meta={`${history.length} jobs`}
          bodyClassName="p-0"
        >
          <HistoryTable history={history} />
        </Disclosure>
      ) : null}
    </div>
  );
}

function PreviewEnvironment({
  clientId,
  businessName,
  preview,
  startPreview,
  approvePreview,
}: {
  clientId: number;
  businessName: string;
  preview: AstroSitePreviewStatusView | null | undefined;
  startPreview: PreviewJob["startPreview"];
  approvePreview: PreviewJob["approvePreview"];
}) {
  const kind = previewEnvironmentKind(preview);
  const generating = isPreviewActive(preview) || startPreview.isPending;
  const host = clientSiteHost(preview?.previewUrl);
  const jobKind = previewPipelineJobKind(kind);
  const currentPhase = preview
    ? previewPipelinePhase(preview.step)
    : "prepare";

  return (
    <EnvironmentCard
      eyebrow="Preview"
      title={environmentTitle(kind, host, businessName)}
      status={previewStatus(kind)}
      host={host}
      href={preview?.previewUrl}
      meta={previewMeta(preview)}
      jobKind={jobKind}
      currentPhase={currentPhase}
      percent={preview ? previewPercent(preview.progress) : 0}
      currentStep={preview ? previewStepLabel(preview.step) : null}
      error={previewError(preview)}
      warnings={preview?.warnings ?? []}
      actions={
        <>
          {(kind === "ready" || kind === "stale") && preview?.previewUrl ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <a href={preview.previewUrl} target="_blank" rel="noreferrer">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Open
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={generating}
            onClick={() => startPreview.mutate({ clientId })}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Rocket className="h-4 w-4" aria-hidden="true" />
            )}
            {previewActionLabel(preview)}
          </Button>
        </>
      }
      footer={
        kind === "ready" || kind === "stale" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={approvePreview.isPending || Boolean(preview?.approvedSha)}
              onClick={() => approvePreview.mutate({ clientId })}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {preview?.approvedSha ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : null}
              {preview?.approvedSha ? "Approved for production" : "Approve preview"}
            </Button>
            {preview?.repositoryUrl ? (
              <RepoLink href={preview.repositoryUrl} />
            ) : null}
          </div>
        ) : preview?.repositoryUrl ? (
          <RepoLink href={preview.repositoryUrl} />
        ) : null
      }
    />
  );
}

function ProductionEnvironment({
  liveUrl,
  publish,
  publishing,
  startPending,
  retryPending,
  onStart,
  onRetry,
}: {
  liveUrl: string | null | undefined;
  publish: AstroSitePublishStatusView | null | undefined;
  publishing: boolean;
  startPending: boolean;
  retryPending: boolean;
  onStart: () => void;
  onRetry: () => void;
}) {
  const kind = publishEnvironmentKind(publish);
  const host = clientSiteHost(liveUrl);
  const jobKind = publishPipelineJobKind(kind);
  const currentPhase = publish
    ? publishPipelinePhase(publish.step)
    : "prepare";

  return (
    <EnvironmentCard
      eyebrow="Production"
      title={productionTitle(kind, host)}
      status={publishStatus(kind)}
      host={host}
      href={liveUrl}
      meta={
        publish
          ? `${publishStepLabel(publish.step)} · ${formatClientUpdatedAt(publish.updatedAt)}`
          : "Publish the approved preview to the live Worker."
      }
      jobKind={jobKind}
      currentPhase={currentPhase}
      percent={publish ? publishPercent(publish.progress) : 0}
      currentStep={publish ? publishStepLabel(publish.step) : null}
      error={publish?.error}
      warnings={[]}
      actions={
        <>
          {liveUrl ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open
              </a>
            </Button>
          ) : null}
          {kind === "failed" ? (
            <Button
              type="button"
              size="sm"
              disabled={retryPending}
              onClick={onRetry}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {retryPending ? (
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
              disabled={startPending}
              onClick={onStart}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {startPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Rocket className="h-4 w-4" aria-hidden="true" />
              )}
              {publish ? "Publish again" : "Publish"}
            </Button>
          )}
        </>
      }
      footer={publish?.repositoryUrl ? <RepoLink href={publish.repositoryUrl} /> : null}
    />
  );
}

function EnvironmentCard({
  eyebrow,
  title,
  status,
  host,
  href,
  meta,
  jobKind,
  currentPhase,
  percent,
  currentStep,
  error,
  warnings,
  actions,
  footer,
}: {
  eyebrow: string;
  title: string;
  status: { tone: BadgeTone; label: string };
  host: string | null;
  href: string | null | undefined;
  meta: string;
  jobKind: PipelineJobKind;
  currentPhase: LaunchPipelinePhase;
  percent: number;
  currentStep: string | null;
  error: string | null | undefined;
  warnings: readonly { code: string; message: string }[];
  actions: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="launchpad-panel flex flex-col overflow-hidden rounded-lg">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
          {href && host ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-sm font-semibold leading-tight hover:underline"
            >
              {title}
            </a>
          ) : (
            <h2 className="mt-1 truncate text-sm font-semibold leading-tight">{title}</h2>
          )}
        </div>
        <StatusBadge tone={status.tone} label={status.label} dot />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{meta}</p>

        {jobKind !== "idle" ? (
          <div className="space-y-3">
            <PipelineStepper jobKind={jobKind} currentPhase={currentPhase} />
            {jobKind === "active" || jobKind === "failed" ? (
              <div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="img"
                  aria-label={`${percent}% complete`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                      jobKind === "failed" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {currentStep ? (
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {currentStep}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            No deployment in this environment yet.
          </p>
        )}

        {error ? (
          <p className="rounded-lg border border-destructive/25 bg-destructive/[0.05] p-3 text-xs leading-relaxed text-destructive">
            {error}
          </p>
        ) : null}

        {warnings.length ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold">
              {warnings.length} setup warning{warnings.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {warnings.map(warning => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2">{actions}</div>
        {footer}
      </div>
    </section>
  );
}

function PipelineStepper({
  jobKind,
  currentPhase,
}: {
  jobKind: PipelineJobKind;
  currentPhase: LaunchPipelinePhase;
}) {
  return (
    <ol className="relative grid grid-cols-4" aria-label="Deployment phases">
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-[12.5%] left-[12.5%] h-px bg-border"
      />
      {launchPipelinePhases.map((phase, index) => {
        const state = pipelinePhaseVisualState(phase, currentPhase, jobKind);
              return (
          <li key={phase} className="relative z-10 min-w-0 text-center">
            <div className="flex justify-center">
              <PhaseMark state={state} index={index + 1} />
            </div>
            <p
                  className={cn(
                "mt-1.5 truncate text-[11px] font-medium",
                phaseLabelClass(state),
              )}
            >
              {LAUNCH_PIPELINE_PHASE_LABELS[phase]}
            </p>
                </li>
              );
            })}
          </ol>
  );
}

function PhaseMark({
  state,
  index,
}: {
  state: PipelinePhaseVisualState;
  index: number;
}) {
  switch (state) {
    case "done":
      return (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <Check className="h-3 w-3" aria-hidden="true" />
        </span>
      );
    case "current":
      return (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        </span>
      );
    case "failed":
      return (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
          {index}
        </span>
      );
    case "todo":
      return (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
          {index}
        </span>
      );
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function PreviewViewport({
  businessName,
  previewUrl,
}: {
  businessName: string;
  previewUrl: string;
}) {
  const host = clientSiteHost(previewUrl);

  return (
    <section className="launchpad-panel overflow-hidden rounded-lg">
      <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
        </span>
        <p className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          {host ?? previewUrl}
        </p>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs font-semibold">
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Open
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
        </Button>
      </header>
      <iframe
        title={`${businessName} preview`}
        src={previewUrl}
        className="h-[32rem] w-full bg-background"
      />
    </section>
  );
}

function CheckTile({ check }: { check: LaunchCheck }) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-3",
        check.state === "fail"
          ? "border-warning/35 bg-warning/[0.04]"
          : check.state === "pass"
            ? "border-border bg-card"
            : "border-border bg-muted/30",
      )}
    >
      <span className="mt-0.5">
        {check.state === "pass" ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        ) : check.state === "fail" ? (
          <Circle className="h-4 w-4 text-warning" aria-hidden="true" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{check.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {check.detail}
        </p>
      </div>
      {check.state === "fail" ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 shrink-0 text-xs font-semibold"
        >
          <Link href={check.fixHref}>Fix</Link>
        </Button>
      ) : null}
    </li>
  );
}

function HistoryTable({ history }: { history: AstroSitePreviewHistoryItem[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-semibold">Job</th>
          <th className="px-4 py-2 font-semibold">Revision</th>
          <th className="px-4 py-2 font-semibold">Status</th>
          <th className="px-4 py-2 font-semibold">Commit</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {history.map((job, index) => (
          <tr key={job.id} className="text-muted-foreground">
            <td className="px-4 py-2.5 font-semibold text-foreground">
              Preview #{history.length - index}
            </td>
            <td className="px-4 py-2.5 tabular-nums">{job.clientRevision}</td>
            <td className="px-4 py-2.5 capitalize">{job.status}</td>
            <td className="px-4 py-2.5 font-mono">
              {job.commitSha ? job.commitSha.slice(0, 9) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RepoLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline"
    >
      Repository
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

function Dot() {
  return <span aria-hidden="true">·</span>;
}

function readinessPercent(readiness: LaunchReadiness): number {
  if (readiness.total <= 0) return 0;
  return Math.round((readiness.passed / readiness.total) * 100);
}

function readinessTone(readiness: LaunchReadiness): BadgeTone {
  if (readiness.ready) return "success";
  if (readiness.failing) return "warning";
  return "info";
}

function previewStatus(kind: PreviewEnvironmentKind): {
  tone: BadgeTone;
  label: string;
} {
  switch (kind) {
    case "idle":
      return { tone: "neutral", label: "Not generated" };
    case "active":
      return { tone: "info", label: "Generating" };
    case "failed":
      return { tone: "danger", label: "Failed" };
    case "ready":
      return { tone: "success", label: "Ready" };
    case "stale":
      return { tone: "warning", label: "Out of date" };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function publishStatus(kind: PublishEnvironmentKind): {
  tone: BadgeTone;
  label: string;
} {
  switch (kind) {
    case "idle":
      return { tone: "neutral", label: "Not published" };
    case "active":
      return { tone: "info", label: "Publishing" };
    case "failed":
      return { tone: "danger", label: "Failed" };
    case "live":
      return { tone: "success", label: "Live" };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function productionTitle(
  kind: PublishEnvironmentKind,
  host: string | null,
): string {
  if (host) return host;
  switch (kind) {
    case "active":
      return "Publishing website";
    case "failed":
      return "Publish failed";
    case "idle":
    case "live":
      return "Not published yet";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function environmentTitle(
  kind: PreviewEnvironmentKind,
  host: string | null,
  businessName: string,
): string {
  if (host) return host;
  switch (kind) {
    case "active":
      return `Generating ${businessName}`;
    case "failed":
      return "Preview failed";
    case "idle":
    case "ready":
    case "stale":
      return "No preview URL yet";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function previewMeta(preview: AstroSitePreviewStatusView | null | undefined): string {
  if (!preview) {
    return "Generate a Cloudflare preview from the saved website configuration. Optional setup becomes warnings, not blockers.";
  }
  if (preview.stale) {
    return `Out of date. Revision ${preview.clientRevision} is deployed; current configuration is revision ${preview.currentRevision}.`;
  }
  if (preview.status === "ready") {
    const sha = preview.commitSha ? ` · ${preview.commitSha.slice(0, 9)}` : "";
    return `Revision ${preview.clientRevision}${sha}`;
  }
  return `${previewStepLabel(preview.step)} · step ${preview.progress.completed} of ${preview.progress.total}`;
}

function previewError(
  preview: AstroSitePreviewStatusView | null | undefined,
): string | null {
  if (!preview?.error) return null;
  return preview.workflowRunId
    ? `${preview.error} GitHub Action #${preview.workflowRunId}.`
    : preview.error;
}

function nextLaunchAction({
  readiness,
  blockers,
  previewKind,
  publishKind,
  approved,
}: {
  readiness: LaunchReadiness;
  blockers: LaunchCheck[];
  previewKind: PreviewEnvironmentKind;
  publishKind: PublishEnvironmentKind;
  approved: boolean;
}): NextLaunchAction {
  const firstBlocker = blockers[0];
  if (firstBlocker) {
    return {
      kind: "fix",
      label: firstBlocker.label,
      detail: firstBlocker.detail,
      href: firstBlocker.fixHref,
    };
  }
  if (!readiness.ready) {
    return {
      kind: "fix",
      label: "Finish loading checks",
      detail: "Configuration is still being read. Refresh if this stays pending.",
    };
  }
  switch (previewKind) {
    case "idle":
      return {
        kind: "preview",
        label: "Generate a preview",
        detail: "Deploy the saved configuration to a Cloudflare preview Worker first.",
      };
    case "active":
      return {
        kind: "preview",
        label: "Preview is generating",
        detail: "The pipeline is preparing, building, and deploying the preview Worker.",
      };
    case "failed":
      return {
        kind: "preview",
        label: "Retry the preview",
        detail: "The last preview job failed. Start a new job after reviewing the error.",
      };
    case "stale":
      return {
        kind: "preview",
        label: "Update the preview",
        detail: "The saved configuration is newer than the deployed preview revision.",
      };
    case "ready":
      break;
    default: {
      const exhaustive: never = previewKind;
      return exhaustive;
    }
  }
  if (!approved) {
    return {
      kind: "approve",
      label: "Approve this preview",
      detail: "Mark the preview as the source you intend to publish.",
    };
  }
  switch (publishKind) {
    case "idle":
      return {
        kind: "publish",
        label: "Publish the website",
        detail: "Promote the approved preview to the production Worker.",
      };
    case "active":
      return {
        kind: "publish",
        label: "Website is publishing",
        detail: "The production pipeline is running. This page will update when it finishes.",
      };
    case "failed":
      return {
        kind: "publish",
        label: "Retry production publish",
        detail: "The last publish job failed. Review the error, then retry.",
      };
    case "live":
      return {
        kind: "done",
        label: "Website is live",
        detail: "Preview and production are in place. Update the preview after the next config change.",
      };
    default: {
      const exhaustive: never = publishKind;
      return exhaustive;
    }
  }
}

function phaseLabelClass(state: PipelinePhaseVisualState): string {
  switch (state) {
    case "done":
      return "text-success";
    case "current":
      return "text-foreground";
    case "failed":
      return "text-destructive";
    case "todo":
      return "text-muted-foreground";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
