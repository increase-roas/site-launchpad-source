import { DeferredNotice } from "@/components/dashboard/DeferredNotice";
import { PageHeading } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import { CAMPAIGN_STRUCTURES, campaignFlowLabel } from "@shared/campaigns";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

/**
 * Campaigns are built and tested but not enabled for operators this phase. The
 * structures are listed from the shared catalogue so this screen describes what
 * is actually coming instead of a hand-written promise that can drift.
 */
export default function DeferredCampaignsPage({ clientId }: { clientId: number }) {
  return (
    <div className="space-y-4">
      <PageHeading
        title="Campaigns"
        description="Paid-traffic funnels that capture leads for this client."
      />

      <DeferredNotice
        title="Coming soon"
        reason="Campaign publishing is not enabled in this phase. Websites are the focus, so campaigns stay switched off rather than let a half-connected funnel take real leads."
        planned={CAMPAIGN_STRUCTURES.map(
          structure => `${structure.name} — ${campaignFlowLabel(structure)}`,
        )}
      />

      <div className="launchpad-panel flex flex-col gap-3 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Meanwhile, keep this client moving</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Brand, media, pages, integrations and website publishing are all live
            today, and none of them wait on campaigns.
          </p>
        </div>
        <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 text-xs font-semibold">
          <Link href={workspaceRoute("pages", clientId)}>
            Go to pages
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
