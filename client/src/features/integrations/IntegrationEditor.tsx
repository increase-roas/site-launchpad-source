import { PageHeading } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { publicErrorMessage } from "@shared/safePublicError";
import type {
  ClientIntegrationProfileDto,
  WebsiteIntegrationEnablement,
} from "@shared/clientIntegrationProfile";
import { integrationPresenceRows } from "@shared/paidFunnel/integrationPresence";
import { ChevronsDownUp, ChevronsUpDown, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { RevealSecret } from "./IntegrationField";
import { IntegrationSection } from "./IntegrationSection";
import { ReadinessSummary } from "./ReadinessSummary";
import { fieldAnchorId } from "./integrationGroupMeta";
import { groupIdForField, groupStatus, initiallyOpenGroupIds } from "./integrationStatus";
import { useIntegrationDrafts } from "./useIntegrationDrafts";

/** Long enough for a section to mount its fields before we scroll to one. */
const REVEAL_DELAY_MS = 80;

export function IntegrationEditor({
  dto,
  enabledIntegrations,
  clientName,
}: {
  dto: ClientIntegrationProfileDto;
  enabledIntegrations: WebsiteIntegrationEnablement;
  clientName?: string;
}) {
  const utils = trpc.useUtils();
  const drafts = useIntegrationDrafts(dto);
  const [openGroups, setOpenGroups] = useState<string[]>(() => initiallyOpenGroupIds(dto));

  const groups = integrationPresenceRows(dto);
  const allExpanded = openGroups.length === groups.length;

  const setGroupOpen = (groupId: string, open: boolean) => {
    setOpenGroups(current =>
      open
        ? current.includes(groupId)
          ? current
          : [...current, groupId]
        : current.filter(id => id !== groupId),
    );
  };

  const jumpToField = (fieldKey: string) => {
    const groupId = groupIdForField(groups, fieldKey);
    if (groupId) setGroupOpen(groupId, true);
    window.setTimeout(() => {
      document
        .getElementById(fieldAnchorId(fieldKey))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = document.getElementById(fieldKey);
      if (input instanceof HTMLInputElement) input.focus({ preventScroll: true });
    }, REVEAL_DELAY_MS);
  };

  const revealMutation = trpc.clients.revealIntegrationSecret.useMutation();

  const revealSecret: RevealSecret = async key => {
    try {
      return (await revealMutation.mutateAsync({ clientId: dto.clientId, key })).value;
    } catch (error) {
      toast.error(
        publicErrorMessage(
          error instanceof Error ? error.message : "",
          "The stored value could not be read.",
        ),
      );
      return null;
    }
  };

  const saveMutation = trpc.clients.saveIntegrationProfile.useMutation({
    onSuccess: async saved => {
      drafts.applySaved(saved);
      setOpenGroups(initiallyOpenGroupIds(saved));
      utils.clients.getIntegrationProfile.setData({ clientId: dto.clientId }, saved);
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.astroConfig.get.invalidate({ clientId: dto.clientId }),
      ]);
      toast.success("Client integrations saved for the website and every funnel.");
    },
    onError: async error => {
      if (error.data?.code === "CONFLICT") {
        try {
          const refreshed = await utils.clients.getIntegrationProfile.fetch({
            clientId: dto.clientId,
          });
          drafts.adoptRemoteIdentifiers(refreshed);
          toast.error(
            "This client changed in another session. Latest identifiers were reloaded; unsaved secret replacements were kept.",
          );
        } catch {
          await utils.clients.getIntegrationProfile.invalidate({ clientId: dto.clientId });
          toast.error("This client changed in another session. Reload before saving again.");
        }
        return;
      }
      toast.error(publicErrorMessage(error.message, "Integrations could not be saved."));
    },
  });

  const errorCount = drafts.fieldErrors.size;

  const save = () => {
    if (errorCount > 0) {
      toast.error("Fix the highlighted integration fields before saving.");
      return;
    }
    saveMutation.mutate({ clientId: dto.clientId, ...drafts.buildPayload() });
  };

  return (
    <div className="space-y-3">
      <PageHeading
        title={clientName ? `${clientName} integrations` : "Integrations"}
        description="Entered once, used by the website and every funnel."
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpenGroups(allExpanded ? [] : groups.map(group => group.id))}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            {allExpanded ? (
              <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
            )}
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        }
      />

      <ReadinessSummary
        dto={dto}
        drafts={drafts}
        enabledIntegrations={enabledIntegrations}
        onJumpToField={jumpToField}
      />

      {groups.map(group => (
        <IntegrationSection
          key={group.id}
          group={group}
          status={groupStatus(group, dto, drafts)}
          secretHints={dto.secretHints}
          revealSecret={revealSecret}
          open={openGroups.includes(group.id)}
          onOpenChange={open => setGroupOpen(group.id, open)}
          drafts={drafts}
        />
      ))}

      {drafts.hasChanges ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs font-semibold">
            {drafts.changeCount} unsaved change{drafts.changeCount === 1 ? "" : "s"}
          </p>
          {errorCount > 0 ? (
            <p className="text-xs font-semibold text-destructive">
              {errorCount} field{errorCount === 1 ? "" : "s"} need fixing first
            </p>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={drafts.discard}
              disabled={saveMutation.isPending}
              className="h-9 text-xs font-semibold"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={saveMutation.isPending || errorCount > 0}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save for website and funnels
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
