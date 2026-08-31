import { cn } from "@/lib/utils";
import type { ClientStatusTone } from "@/lib/clientBoard";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary"
  | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-muted-foreground/60",
};

export function StatusBadge({
  tone,
  label,
  dot = false,
  className,
}: {
  tone: BadgeTone;
  label: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
        />
      ) : null}
      {label}
    </span>
  );
}

const CLIENT_TONE_TO_BADGE: Record<ClientStatusTone, BadgeTone> = {
  live: "success",
  ready: "primary",
  publishing: "info",
  attention: "warning",
  critical: "danger",
};

export function clientBadgeTone(tone: ClientStatusTone): BadgeTone {
  return CLIENT_TONE_TO_BADGE[tone];
}

/** Compact status marker for dense lists where a full pill does not fit. */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: ClientStatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} title={label}>
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 rounded-full", DOT_CLASSES[clientBadgeTone(tone)])}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Client operational status, rendered with the shared badge treatment. */
export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: ClientStatusTone;
  label: string;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={clientBadgeTone(tone)}
      label={label}
      dot
      className={className}
    />
  );
}
