import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ClientIntegrationSecretHints } from "@shared/clientIntegrationProfile";
import type { IntegrationPresenceGroup } from "@shared/paidFunnel/integrationPresence";
import { ChevronRight } from "lucide-react";
import { IntegrationField, type RevealSecret } from "./IntegrationField";
import { groupAnchorId, groupMeta } from "./integrationGroupMeta";
import type { GroupStatus, SectionState } from "./integrationStatus";
import type { IntegrationDrafts } from "./useIntegrationDrafts";

const BORDER_TONE: Record<SectionState, string> = {
  complete: "border-l-success",
  incomplete: "border-l-warning",
  invalid: "border-l-destructive",
};

const CHIP_TONE: Record<SectionState, string> = {
  complete: "bg-success/10 text-success",
  incomplete: "bg-warning/15 text-warning",
  invalid: "bg-destructive/10 text-destructive",
};

function badgeLabel(status: GroupStatus): string {
  if (status.state === "invalid") return "Check fields";
  if (status.state === "incomplete") return `${status.missingRequired.length} missing`;
  return "Complete";
}

export function IntegrationSection({
  group,
  status,
  secretHints,
  revealSecret,
  open,
  onOpenChange,
  drafts,
}: {
  group: IntegrationPresenceGroup;
  status: GroupStatus;
  secretHints: ClientIntegrationSecretHints;
  revealSecret: RevealSecret;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: IntegrationDrafts;
}) {
  const meta = groupMeta(group.id, group.label);
  const Icon = meta.icon;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section
        id={groupAnchorId(group.id)}
        className={cn(
          "launchpad-panel scroll-mt-4 overflow-hidden rounded-lg border-l-[3px]",
          BORDER_TONE[status.state],
        )}
      >
        <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
              CHIP_TONE[status.state],
            )}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold leading-tight">{meta.name}</span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  CHIP_TONE[status.state],
                )}
              >
                {badgeLabel(status)}
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {meta.purpose}
            </span>
          </span>

          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
            aria-hidden="true"
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid gap-px border-t border-border bg-border">
            {group.fields.map(field => (
              <IntegrationField
                key={field.key}
                fieldKey={field.key}
                presence={field.presence}
                secretHints={secretHints}
                revealSecret={revealSecret}
                drafts={drafts}
              />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
