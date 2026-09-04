import { PageHeading } from "@/components/dashboard/PanelCard";
import { StatusBadge, type BadgeTone } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { shouldRetryWorkspaceQuery } from "@/lib/queryErrors";
import { trpc } from "@/lib/trpc";
import {
  activeCampaignStructures,
  campaignFlowLabel,
  campaignStructureForTemplate,
  CAMPAIGN_STRUCTURES,
  type CampaignStructure,
} from "@shared/campaigns";
import { SIMPLE_FORM_TEMPLATE_KEY } from "@shared/simpleFormContract";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CampaignEditor } from "./CampaignEditor";
import {
  campaignSearch,
  parseCampaignSearch,
  FIRST_CAMPAIGN_TAB,
  type CampaignTab,
} from "./campaignTabs";

const DEPLOYMENT_STATUS: Record<
  "draft" | "ready" | "deployed",
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "Draft", tone: "neutral" },
  ready: { label: "Ready to publish", tone: "primary" },
  deployed: { label: "Published", tone: "success" },
};

/** The chevrons carry the sequence visually, so the label carries it aloud. */
function FlowSteps({ structure }: { structure: CampaignStructure }) {
  return (
    <div
      role="img"
      aria-label={campaignFlowLabel(structure)}
      className="flex flex-wrap items-center gap-1"
    >
      {structure.steps.map((step, index) => (
        <span key={step} aria-hidden="true" className="flex items-center gap-1">
          <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">
            {step}
          </span>
          {index < structure.steps.length - 1 ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : null}
        </span>
      ))}
    </div>
  );
}

function CampaignRow({
  name,
  slug,
  structure,
  deploymentStatus,
  onOpen,
}: {
  name: string;
  slug: string;
  structure: CampaignStructure | null;
  deploymentStatus: keyof typeof DEPLOYMENT_STATUS;
  onOpen: () => void;
}) {
  const status = DEPLOYMENT_STATUS[deploymentStatus];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="launchpad-panel group flex w-full flex-wrap items-center gap-4 rounded-lg p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold leading-tight">{name}</h3>
          <StatusBadge tone={status.tone} label={status.label} dot />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-mono">/{slug}</span>
          {structure ? ` · ${structure.name}` : ""}
        </p>
        {structure ? (
          <div className="mt-2.5">
            <FlowSteps structure={structure} />
          </div>
        ) : null}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary">
        Open
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

function CreateCampaignPanel({
  structure,
  creating,
  onCreate,
}: {
  structure: CampaignStructure;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="launchpad-panel flex flex-wrap items-center gap-4 rounded-lg p-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight">{structure.name}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {structure.summary}
        </p>
        <div className="mt-2.5">
          <FlowSteps structure={structure} />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={creating}
        onClick={onCreate}
        className="h-9 shrink-0 gap-1.5 text-xs font-semibold"
      >
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        Create campaign
      </Button>
    </div>
  );
}

export default function CampaignsPage({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const initial = parseCampaignSearch(
    typeof window === "undefined" ? "" : window.location.search
  );
  const [campaignId, setCampaignId] = useState<number | null>(initial.campaignId);
  const [tab, setTab] = useState<CampaignTab>(initial.tab);
  const listQuery = trpc.funnelBuilder.list.useQuery(
    { clientId },
    { retry: shouldRetryWorkspaceQuery }
  );

  // Only a client switch clears the selection. Resetting on mount would drop a
  // campaign deep link before the editor ever renders.
  const previousClientIdRef = useRef(clientId);
  useEffect(() => {
    if (previousClientIdRef.current === clientId) return;
    previousClientIdRef.current = clientId;
    setCampaignId(null);
    setTab(FIRST_CAMPAIGN_TAB);
  }, [clientId]);

  const openCampaign = (id: number, nextTab: CampaignTab = FIRST_CAMPAIGN_TAB) => {
    setCampaignId(id);
    setTab(nextTab);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${campaignSearch(id, nextTab)}`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeTab = (nextTab: CampaignTab) => {
    if (campaignId == null) return;
    setTab(nextTab);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${campaignSearch(campaignId, nextTab)}`
    );
  };

  const closeCampaign = () => {
    setCampaignId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const createFromTemplate = trpc.simpleForm.createFromTemplate.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.funnelBuilder.list.invalidate({ clientId }),
        utils.workspace.get.invalidate({ clientId }),
      ]);
      toast.success(result.alreadyExists ? "Opened the existing campaign." : "Campaign created.");
      openCampaign(result.funnelId);
    },
    onError: error => toast.error(error.message),
  });

  if (campaignId != null) {
    return (
      <CampaignEditor
        key={campaignId}
        clientId={clientId}
        campaignId={campaignId}
        tab={tab}
        onTabChange={changeTab}
        onBack={closeCampaign}
      />
    );
  }

  const rows = listQuery.data ?? [];
  const campaigns = rows.filter(row => campaignStructureForTemplate(row.templateKey));
  // A structure is offered until this client already has a campaign built from
  // it. `createFromTemplate` only builds the simple-form template today.
  const creatable = activeCampaignStructures().flatMap(structure => {
    const templateKey = SIMPLE_FORM_TEMPLATE_KEY;
    if (structure.templateKey !== templateKey) return [];
    if (campaigns.some(campaign => campaign.templateKey === templateKey)) return [];
    return [{ structure, templateKey }];
  });
  const upcoming = CAMPAIGN_STRUCTURES.filter(
    structure => structure.availability === "deferred"
  );

  return (
    <div className="space-y-3">
      <PageHeading title="Campaigns" />

      {listQuery.isLoading ? (
        <div className="launchpad-panel grid min-h-32 place-items-center rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : listQuery.error ? (
        <div className="launchpad-panel rounded-lg p-4 text-xs text-destructive">
          {listQuery.error.message}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <CampaignRow
              key={campaign.id}
              name={campaign.name}
              slug={campaign.slug}
              structure={campaignStructureForTemplate(campaign.templateKey)}
              deploymentStatus={campaign.deploymentStatus}
              onOpen={() => openCampaign(campaign.id)}
            />
          ))}
          {creatable.map(({ structure, templateKey }) => (
            <CreateCampaignPanel
              key={structure.key}
              structure={structure}
              creating={createFromTemplate.isPending}
              onCreate={() => createFromTemplate.mutate({ clientId, templateKey })}
            />
          ))}
        </div>
      )}

      {upcoming.length ? (
        <p className="text-xs text-muted-foreground">
          {upcoming.map(structure => structure.name).join(" and ")} structure
          {upcoming.length === 1 ? " is" : "s are"} coming.
        </p>
      ) : null}
    </div>
  );
}
