import { cn } from "@/lib/utils";
import {
  CONFIG_TAB_IDS,
  type ConfigReadiness,
  type ConfigTabId,
  type TabReadiness,
} from "@shared/astroConfigReadiness";

/**
 * Replaces the plain tab list. Each segment carries a count and a progress bar,
 * so "what is left" is answerable without opening a tab.
 */

const CHIP_TONE: Record<TabReadiness["state"], string> = {
  complete: "bg-success/10 text-success",
  incomplete: "bg-warning/15 text-warning",
  invalid: "bg-destructive/10 text-destructive",
};

const BAR_TONE: Record<TabReadiness["state"], string> = {
  complete: "bg-success",
  incomplete: "bg-warning",
  invalid: "bg-destructive",
};

function segmentDetail(readiness: TabReadiness): string {
  if (readiness.invalid > 0) return `${readiness.invalid} invalid`;
  if (readiness.incomplete > 0) return `${readiness.incomplete} to fill`;
  return "Complete";
}

export function ReadinessStrip({
  readiness,
  active,
  onSelect,
}: {
  readiness: ConfigReadiness;
  active: ConfigTabId;
  onSelect: (tab: ConfigTabId) => void;
}) {
  return (
    <nav
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5"
      aria-label="Configuration sections"
    >
      {CONFIG_TAB_IDS.map((tab, index) => {
        const summary = readiness.tabs[tab];
        const percent = summary.requiredTotal
          ? Math.round((summary.requiredFilled / summary.requiredTotal) * 100)
          : 100;
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col gap-2 px-4 py-3 text-left transition-colors",
              isActive
                ? "bg-primary/[0.06] shadow-[inset_0_-2px_0_var(--primary)]"
                : "bg-card hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs font-semibold",
                  CHIP_TONE[summary.state],
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                {summary.label}
              </span>
            </span>
            <span className="block h-1 overflow-hidden rounded-full bg-border">
              <span
                className={cn("block h-1 rounded-full transition-[width]", BAR_TONE[summary.state])}
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {summary.requiredFilled} of {summary.requiredTotal} &middot; {segmentDetail(summary)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
