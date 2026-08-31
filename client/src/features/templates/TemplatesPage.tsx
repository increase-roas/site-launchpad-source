import { DeferredNotice } from "@/components/dashboard/DeferredNotice";
import { PageHeading, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import { LayoutTemplate, ShieldCheck } from "lucide-react";

/**
 * The template registry is scoped per client, so this page reports the catalogue
 * available to the selected client rather than a global list that does not exist.
 */
export default function TemplatesPage() {
  const { selectedClient, selectedClientId } = useWorkspace();
  const templatesQuery = trpc.paidFunnel.listTemplates.useQuery(
    { clientId: selectedClientId ?? 0 },
    { enabled: selectedClientId != null, retry: false },
  );

  const templates = templatesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Templates"
        description="Approved starting points for client websites and funnels."
      />

      <PanelCard
        title="Funnel templates"
        description={
          selectedClient
            ? `Registered for ${selectedClient.client.businessName}.`
            : "Select a client to see its catalogue."
        }
        bodyClassName="p-0"
      >
        {selectedClientId == null ? (
          <p className="p-4 text-xs leading-relaxed text-muted-foreground">
            Templates are registered per client. Pick a client from the switcher to
            see what it can start from.
          </p>
        ) : templatesQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : templatesQuery.error ? (
          <p className="p-4 text-xs text-muted-foreground">
            Templates could not be loaded.
          </p>
        ) : templates.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No approved templates are registered yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map(template => (
              <li
                key={template.templateKey}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {template.templateKey} · v{template.version}
                  </p>
                </div>
                <StatusBadge tone="primary" label={template.kind} />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard title="Website template">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Astro website template</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Every client site is generated from the vendored Astro template. Its
              manifest is contract-checked on every build, so page structure and
              homepage sections are fixed per template version.
            </p>
          </div>
        </div>
      </PanelCard>

      <DeferredNotice
        title="Template management is read-only in this phase"
        reason="Templates are registered by the platform and validated against a canonical manifest. Uploading or editing template versions from the UI is not enabled."
        planned={[
          "Publish a new template version and roll clients forward",
          "Per-client template pinning and upgrade preview",
          "Diff a client's configuration against the template default",
        ]}
      />
    </div>
  );
}
