import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAstroPreviewJob } from "@/features/launch/useAstroPreviewJob";
import { clientAdminHref } from "@/lib/clientBoard";
import { trpc } from "@/lib/trpc";
import { configurationRoute, workspaceRoute } from "@/lib/workspaceNavigation";
import { websiteIntegrationEnablement } from "@shared/clientIntegrationProfile";
import { publicErrorMessage } from "@shared/safePublicError";
import { AlertCircle, ArrowLeft, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { IntegrationEditor } from "./IntegrationEditor";

export default function ClientIntegrationsPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const query = trpc.clients.getIntegrationProfile.useQuery({ clientId });
  // Which services this site uses is set on the Configuration tab, and it
  // decides which of these credentials are actually required.
  const configQuery = trpc.astroConfig.get.useQuery({ clientId });
  const { preview } = useAstroPreviewJob(clientId);
  const adminHref =
    clientAdminHref(selectedClient?.operationalSummary.liveUrl) ??
    clientAdminHref(preview?.previewUrl);

  if (query.isLoading || configQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="launchpad-panel rounded-lg p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">Integrations could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {publicErrorMessage(
            query.error?.message,
            "Try again. If this keeps happening, ask Alex for help.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 text-xs font-semibold text-muted-foreground"
      >
        <Link href={configurationRoute(clientId, "technical")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to configuration
        </Link>
      </Button>

      <section className="launchpad-panel flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Floor inventory
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Add products on the Inventory tab. The Website admin password below is only
            needed if someone signs in at the site’s{" "}
            <span className="font-medium text-foreground">/admin</span> page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 text-xs font-semibold">
            <Link href={workspaceRoute("inventory", clientId)}>Open Inventory</Link>
          </Button>
          {adminHref ? (
            <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 text-xs font-semibold">
              <a href={adminHref} target="_blank" rel="noreferrer">
                Site /admin
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      <IntegrationEditor
        dto={query.data}
        enabledIntegrations={websiteIntegrationEnablement(
          configQuery.data?.input.integrations,
        )}
        clientName={selectedClient?.client.businessName}
      />
    </div>
  );
}
