import { DeferredNotice } from "@/components/dashboard/DeferredNotice";
import { PageHeading } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import type { PrimarySection } from "@/app/navigation";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

type DeferredSettingsSection = Extract<PrimarySection, "templates" | "systemSettings">;

const CONTENT: Record<
  DeferredSettingsSection,
  { title: string; description: string; reason: string; planned: readonly string[] }
> = {
  templates: {
    title: "Templates",
    description: "Approved starting points for client websites and funnels.",
    reason:
      "There is no workspace-wide template catalogue yet. Templates are selected per client when creating a funnel, not from this section.",
    planned: [
      "A global catalogue of website and funnel templates",
      "Default template versions applied to new clients",
      "Preview and approval before a template is offered in a workspace",
    ],
  },
  systemSettings: {
    title: "System Settings",
    description: "Workspace-level defaults and platform configuration.",
    reason:
      "Configuration is stored per client today; there is no workspace-level settings store yet.",
    planned: [
      "Default theme presets and template versions for new clients",
      "Publisher credentials and account bindings",
      "Notification preferences for failed jobs",
    ],
  },
};

export default function DeferredSettingsPage({
  section,
}: {
  section: DeferredSettingsSection;
}) {
  const content = CONTENT[section];

  return (
    <div className="space-y-4">
      <PageHeading title={content.title} description={content.description} />
      <DeferredNotice
        title="Not enabled in this phase"
        reason={content.reason}
        planned={content.planned}
      />
      <div className="launchpad-panel flex flex-col gap-3 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Meanwhile, keep clients moving</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Brand, pages, funnels, integrations, and readiness checks are all live
            today.
          </p>
        </div>
        <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 text-xs font-semibold">
          <Link href="/clients">
            Go to clients
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
