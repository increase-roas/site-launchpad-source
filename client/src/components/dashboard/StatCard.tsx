import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "primary" | "success" | "warning" | "danger" | "neutral";

const ICON_WRAP: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

const BAR: Record<StatTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/40",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  note,
  noteTone,
  progress,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Secondary line, e.g. "89% of pages" or "+3 added this week". */
  note?: string;
  noteTone?: StatTone;
  /** Percentage 0–100 for the inline bar. */
  progress?: number;
}) {
  const clamped =
    progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="launchpad-panel flex items-start gap-3 rounded-lg p-4">
      {Icon ? (
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
            ICON_WRAP[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums">
          {value}
        </p>

        {note ? (
          <p
            className={cn(
              "mt-1 truncate text-xs font-medium",
              noteTone === "success"
                ? "text-success"
                : noteTone === "warning"
                  ? "text-warning"
                  : noteTone === "danger"
                    ? "text-destructive"
                    : noteTone === "primary"
                      ? "text-primary"
                      : "text-muted-foreground",
            )}
          >
            {note}
          </p>
        ) : null}

        {clamped !== undefined ? (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${clamped}%`}
          >
            <div
              className={cn("h-full rounded-full", BAR[tone])}
              style={{ width: `${clamped}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
