import { cn } from "@/lib/utils";
import type { CampaignTab } from "./campaignTabs";

export type CampaignStepTone = "ready" | "attention" | "muted";

export type CampaignStepItem = {
  key: CampaignTab;
  label: string;
  /** Short readiness line under the label, e.g. "Ready" or "2 missing". */
  status: string;
  tone: CampaignStepTone;
};

const STATUS_CLASSES: Record<CampaignStepTone, string> = {
  ready: "text-success",
  attention: "text-warning",
  muted: "text-muted-foreground",
};

export function CampaignStepper({
  items,
  current,
  onSelect,
}: {
  items: readonly CampaignStepItem[];
  current: CampaignTab;
  onSelect: (tab: CampaignTab) => void;
}) {
  return (
    <nav
      aria-label="Campaign steps"
      className="launchpad-panel grid overflow-hidden rounded-lg sm:grid-cols-3"
    >
      {items.map((item, index) => {
        const selected = item.key === current;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={selected ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 border-border px-4 py-3 text-left transition-colors",
              "border-t first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0",
              selected ? "bg-primary/[0.06]" : "hover:bg-muted/60",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-sm font-semibold leading-tight",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-xs font-medium",
                  STATUS_CLASSES[item.tone],
                )}
              >
                {item.status}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
