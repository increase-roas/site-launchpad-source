import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { shouldRetryWorkspaceQuery } from "@/lib/queryErrors";
import { trpc } from "@/lib/trpc";
import { campaignStructureForTemplate } from "@shared/campaigns";
import type { SimpleFormStoredRecord } from "@shared/simpleFormConfig";
import type { SimpleFormPublishStatusView } from "@shared/simpleFormPublish";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CampaignAsset } from "./campaignFields";
import { campaignPendingRecord, stampConsentVersion } from "./campaignRecord";
import {
  campaignBlockerGroups,
  campaignStepStatuses,
  type CampaignBlockerGroups,
} from "./campaignSteps";
import { CampaignStepper, type CampaignStepItem } from "./CampaignStepper";
import { CAMPAIGN_TABS, CAMPAIGN_TAB_LABELS, type CampaignTab } from "./campaignTabs";
import {
  createPublishAdvanceController,
  effectivePublishStatus,
  initialPublishAdvanceControllerState,
  publishActionForState,
  publishAdvanceDelayMs,
  publishPollInterval,
  publishStepLabel,
  type PublishAdvanceController,
  type PublishAdvanceControllerState,
} from "./publishControl";
import { CampaignContentTab } from "./tabs/CampaignContentTab";
import { CampaignPublishTab } from "./tabs/CampaignPublishTab";
import { CampaignSetupTab } from "./tabs/CampaignSetupTab";

export function CampaignEditor({
  clientId,
  campaignId,
  tab,
  onTabChange,
  onBack,
}: {
  clientId: number;
  campaignId: number;
  tab: CampaignTab;
  onTabChange: (tab: CampaignTab) => void;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const query = trpc.simpleForm.get.useQuery(
    { clientId, funnelId: campaignId },
    { retry: shouldRetryWorkspaceQuery }
  );
  const publishQuery = trpc.simpleForm.publishStatus.useQuery(
    { clientId, funnelId: campaignId },
    { refetchInterval: state => publishPollInterval(state.state.data) }
  );
  const [record, setRecord] = useState<SimpleFormStoredRecord | null>(null);
  const [baseline, setBaseline] = useState<SimpleFormStoredRecord | null>(null);
  const [zipText, setZipText] = useState("");
  const [activePublish, setActivePublish] = useState<{
    clientId: number;
    funnelId: number;
    value: SimpleFormPublishStatusView;
  } | null>(null);
  const authoritativePublishRef = useRef<{
    clientId: number;
    funnelId: number;
    value: SimpleFormPublishStatusView | null;
  } | null>(null);
  const [publishAdvanceControl, setPublishAdvanceControl] =
    useState<PublishAdvanceControllerState>(initialPublishAdvanceControllerState);
  const publishAdvanceControllerRef = useRef<PublishAdvanceController | null>(null);
  if (publishAdvanceControllerRef.current === null) {
    publishAdvanceControllerRef.current = createPublishAdvanceController(
      setPublishAdvanceControl
    );
  }
  const publishAdvanceController = publishAdvanceControllerRef.current;

  useEffect(() => {
    if (!query.data) return;
    setRecord(query.data.record);
    setBaseline(query.data.record);
    setZipText(query.data.record.config.serviceAreaZipCodes.join("\n"));
  }, [query.data]);

  useEffect(() => () => publishAdvanceController.dispose(), [publishAdvanceController]);

  const saveMutation = trpc.simpleForm.save.useMutation({
    onSuccess: async view => {
      await Promise.all([
        utils.simpleForm.get.invalidate({ clientId, funnelId: campaignId }),
        utils.clients.list.invalidate(),
      ]);
      setRecord(view.record);
      setBaseline(view.record);
      toast.success("Campaign saved.");
    },
    onError: error => toast.error(error.message),
  });
  const startPublishMutation = trpc.simpleForm.startPublish.useMutation({
    onSuccess: async status => {
      setActivePublish({ clientId, funnelId: campaignId, value: status });
      await Promise.all([
        utils.simpleForm.publishStatus.invalidate({ clientId, funnelId: campaignId }),
        utils.clients.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const advancePublishMutation = trpc.simpleForm.advancePublish.useMutation({
    onSuccess: async status => {
      publishAdvanceController.observeSuccessfulStatus(status);
      setActivePublish({ clientId, funnelId: campaignId, value: status });
      await Promise.all([
        utils.simpleForm.publishStatus.invalidate({ clientId, funnelId: campaignId }),
        utils.clients.list.invalidate(),
      ]);
    },
    onError: error => {
      publishAdvanceController.completeError();
      toast.error(error.message);
    },
    onSettled: () => publishAdvanceController.completeRequest(),
  });
  const publishAdvancePending = advancePublishMutation.isPending;
  const mutatePublishAdvance = advancePublishMutation.mutate;

  const localPublish =
    activePublish?.clientId === clientId && activePublish.funnelId === campaignId
      ? activePublish.value
      : null;
  const previousAuthoritativePublish =
    authoritativePublishRef.current?.clientId === clientId &&
    authoritativePublishRef.current.funnelId === campaignId
      ? authoritativePublishRef.current.value
      : null;
  const publish = effectivePublishStatus(
    localPublish,
    previousAuthoritativePublish,
    publishQuery.data
  );
  authoritativePublishRef.current = { clientId, funnelId: campaignId, value: publish };

  useEffect(() => {
    if (!publishQuery.data) return;
    publishAdvanceController.observeSuccessfulStatus(publishQuery.data);
  }, [publishAdvanceController, publishQuery.data]);

  useEffect(() => {
    if (!publish || publishAdvancePending) {
      publishAdvanceController.cancelScheduled();
      return;
    }
    publishAdvanceController.scheduleAutomatic(
      publish,
      publishAdvanceDelayMs(publish),
      () => {
        mutatePublishAdvance({ clientId, funnelId: campaignId, retryFailed: false });
      }
    );
    return () => publishAdvanceController.cancelScheduled();
  }, [
    campaignId,
    clientId,
    mutatePublishAdvance,
    publish,
    publishAdvanceController,
    publishAdvancePending,
  ]);

  if (query.error) {
    return (
      <div className="launchpad-panel rounded-lg p-4 text-xs text-destructive">
        {query.error.message}
      </div>
    );
  }

  const detail = query.data;
  if (!detail || !record || !baseline) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  const slug = detail.funnel.slug;
  const structure = campaignStructureForTemplate(detail.funnel.templateKey);
  const nextRecord = campaignPendingRecord(record, zipText);
  const dirty = JSON.stringify(nextRecord) !== JSON.stringify(baseline);

  const save = () =>
    saveMutation.mutate({
      clientId,
      funnelId: campaignId,
      record: stampConsentVersion(nextRecord, baseline),
    });

  const leave = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this campaign?")) return;
    onBack();
  };

  const publishAction = publishActionForState(
    publish,
    publishAdvanceControl.pausedAfterErrorVersion
  );
  const publishBusy =
    startPublishMutation.isPending || publishAdvancePending || publishAdvanceControl.locked;

  const statuses = campaignStepStatuses(detail.readiness);
  const blockers = campaignBlockerGroups(detail.readiness);
  const steps: CampaignStepItem[] = CAMPAIGN_TABS.map(key => {
    const label = CAMPAIGN_TAB_LABELS[key];
    if (key === "publish") {
      if (publish?.status === "published") return { key, label, status: "Live", tone: "ready" };
      if (publish) {
        return {
          key,
          label,
          status: publishStepLabel(publish.step),
          tone: publish.status === "failed" ? "attention" : "muted",
        };
      }
      if (!detail.readiness) return { key, label, status: "Checking…", tone: "muted" };
      const outstanding = blockers.campaign.length + blockers.clientSetup.length;
      return outstanding
        ? { key, label, status: `${outstanding} to fix`, tone: "muted" }
        : { key, label, status: "Ready", tone: "ready" };
    }
    const status = statuses[key];
    if (status.missingCount === null) {
      return { key, label, status: "Checking…", tone: "muted" };
    }
    return {
      key,
      label,
      status: status.ready ? "Ready" : `${status.missingCount} to fix`,
      tone: status.ready ? "ready" : "attention",
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Campaigns
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight tracking-tight">
              {detail.funnel.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {structure ? `${structure.name} · ` : ""}
              <span className="font-mono">/{slug}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {dirty ? <StatusBadge tone="warning" label="Unsaved" dot /> : null}
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={save}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <CampaignStepper items={steps} current={tab} onSelect={onTabChange} />

      <CampaignTabPanel
        tab={tab}
        clientId={clientId}
        slug={slug}
        record={record}
        assets={detail.assets}
        zipText={zipText}
        blockers={blockers}
        configurationReady={detail.readiness?.configurationReady ?? false}
        publish={publish}
        publishAction={publishAction}
        publishBusy={publishBusy}
        onRecordChange={setRecord}
        onZipTextChange={setZipText}
        onTabChange={onTabChange}
        onPublish={() => {
          publishAdvanceController.resetForStart();
          startPublishMutation.mutate({ clientId, funnelId: campaignId });
        }}
        onRetry={() => {
          if (!publish) return;
          publishAdvanceController.retry(publish, () => {
            mutatePublishAdvance({ clientId, funnelId: campaignId, retryFailed: true });
          });
        }}
      />
    </div>
  );
}

function CampaignTabPanel({
  tab,
  clientId,
  slug,
  record,
  assets,
  zipText,
  blockers,
  configurationReady,
  publish,
  publishAction,
  publishBusy,
  onRecordChange,
  onZipTextChange,
  onTabChange,
  onPublish,
  onRetry,
}: {
  tab: CampaignTab;
  clientId: number;
  slug: string;
  record: SimpleFormStoredRecord;
  assets: CampaignAsset[];
  zipText: string;
  blockers: CampaignBlockerGroups;
  configurationReady: boolean;
  publish: SimpleFormPublishStatusView | null;
  publishAction: "Publish" | "Retry" | null;
  publishBusy: boolean;
  onRecordChange: (record: SimpleFormStoredRecord) => void;
  onZipTextChange: (zipText: string) => void;
  onTabChange: (tab: CampaignTab) => void;
  onPublish: () => void;
  onRetry: () => void;
}) {
  switch (tab) {
    case "setup":
      return (
        <CampaignSetupTab
          record={record}
          assets={assets}
          zipText={zipText}
          onChange={onRecordChange}
          onZipTextChange={onZipTextChange}
        />
      );
    case "content":
      return (
        <CampaignContentTab record={record} assets={assets} onChange={onRecordChange} />
      );
    case "publish":
      return (
        <CampaignPublishTab
          clientId={clientId}
          slug={slug}
          blockers={blockers}
          configurationReady={configurationReady}
          publish={publish}
          publishAction={publishAction}
          publishBusy={publishBusy}
          onOpenStep={onTabChange}
          onPublish={onPublish}
          onRetry={onRetry}
        />
      );
    default: {
      const exhaustive: never = tab;
      throw new Error(`Unhandled campaign tab: ${String(exhaustive)}`);
    }
  }
}
