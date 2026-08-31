import { cn } from "@/lib/utils";
import {
  CLIENT_INTEGRATION_FIELD_LABELS,
  isProfileKey,
  type ClientIntegrationProfileDto,
  type WebsiteIntegrationEnablement,
} from "@shared/clientIntegrationProfile";
import { Globe, Route, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { effectiveReadiness } from "./integrationStatus";
import type { IntegrationDrafts } from "./useIntegrationDrafts";

function fieldLabel(key: string): string {
  return isProfileKey(key) ? CLIENT_INTEGRATION_FIELD_LABELS[key] : key;
}

function MissingChips({
  keys,
  tone,
  onJumpToField,
}: {
  keys: string[];
  tone: "warning" | "destructive";
  onJumpToField: (key: string) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {keys.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => onJumpToField(key)}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            tone === "warning"
              ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
              : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
          )}
        >
          {fieldLabel(key)}
        </button>
      ))}
    </div>
  );
}

function SurfaceRow({
  icon: Icon,
  name,
  blocked,
  missingKeys,
  onJumpToField,
}: {
  icon: LucideIcon;
  name: string;
  blocked: boolean;
  missingKeys: string[];
  onJumpToField: (key: string) => void;
}) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold">{name}</span>
        <span className="ml-auto rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
          {blocked ? "Blocked" : `${missingKeys.length} missing`}
        </span>
      </div>

      {missingKeys.length > 0 ? (
        <MissingChips keys={missingKeys} tone="warning" onJumpToField={onJumpToField} />
      ) : null}
    </div>
  );
}

/**
 * Only rendered when there is something to act on. When both surfaces are ready
 * and nothing is in conflict, a row of green badges says nothing the section
 * headers below do not already say.
 */
export function ReadinessSummary({
  dto,
  drafts,
  enabledIntegrations,
  onJumpToField,
}: {
  dto: ClientIntegrationProfileDto;
  drafts: IntegrationDrafts;
  enabledIntegrations: WebsiteIntegrationEnablement;
  onJumpToField: (key: string) => void;
}) {
  const readiness = effectiveReadiness(dto, drafts, enabledIntegrations);
  const blocked = dto.reconciliationStatus === "conflict";
  const surfaces = [
    {
      icon: Globe,
      name: "Website",
      ready: readiness.websiteReady,
      missingKeys: readiness.missingWebsiteKeys,
    },
    {
      icon: Route,
      name: "Funnels",
      ready: readiness.funnelReady,
      missingKeys: readiness.missingFunnelKeys,
    },
  ].filter(surface => !surface.ready);

  if (surfaces.length === 0 && dto.reconciliationStatus === "ready") return null;

  return (
    <section className="launchpad-panel overflow-hidden rounded-lg">
      {surfaces.length > 0 ? (
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {surfaces.map(surface => (
            <SurfaceRow
              key={surface.name}
              icon={surface.icon}
              name={surface.name}
              blocked={blocked}
              missingKeys={surface.missingKeys}
              onJumpToField={onJumpToField}
            />
          ))}
        </div>
      ) : null}

      {blocked ? (
        <div
          className={cn(
            "bg-destructive/5 px-4 py-3",
            surfaces.length > 0 && "border-t border-border",
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            {dto.conflictedKeys.length} field
            {dto.conflictedKeys.length === 1 ? "" : "s"} disagree across older setup records
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Blocked until settled. Enter the value you want to keep and save.
          </p>
          <MissingChips
            keys={dto.conflictedKeys}
            tone="destructive"
            onJumpToField={onJumpToField}
          />
        </div>
      ) : dto.reconciliationStatus === "pending" ? (
        <p
          className={cn(
            "px-4 py-2.5 text-xs text-muted-foreground",
            surfaces.length > 0 && "border-t border-border",
          )}
        >
          Not reconciled yet. Saving here makes these the source of truth.
        </p>
      ) : null}
    </section>
  );
}
