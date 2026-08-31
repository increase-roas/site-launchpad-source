import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import { configurationRoute } from "@/lib/workspaceNavigation";
import { websiteIntegrationEnablement } from "@shared/clientIntegrationProfile";
import { publicErrorMessage } from "@shared/safePublicError";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { IntegrationEditor } from "./IntegrationEditor";

export default function ClientIntegrationsPage({ clientId }: { clientId: number }) {
  const { selectedClient } = useWorkspace();
  const query = trpc.clients.getIntegrationProfile.useQuery({ clientId });
  // Which services this site uses is set on the Configuration tab, and it
  // decides which of these credentials are actually required.
  const configQuery = trpc.astroConfig.get.useQuery({ clientId });

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
