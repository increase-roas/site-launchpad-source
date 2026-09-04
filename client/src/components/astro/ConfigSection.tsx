import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  ConfigSectionId,
  FieldState,
  SectionMeter,
} from "@shared/astroConfigReadiness";
import { AlertCircle, ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared anatomy for the Configuration tab. Colour encodes state only, so an
 * operator can scan for amber and skip anything calm. Type stays on the app's
 * two-step scale: text-sm for titles and values, text-xs for everything else.
 */

const STATE_TONE: Record<SectionMeter["state"], string> = {
  complete: "border-l-success",
  incomplete: "border-l-warning",
  invalid: "border-l-destructive",
};

const CHIP_TONE: Record<SectionMeter["state"], string> = {
  complete: "bg-success/10 text-success",
  incomplete: "bg-warning/15 text-warning",
  invalid: "bg-destructive/10 text-destructive",
};

/** Sections that are pure actions, such as the config export, carry no meter. */
const NEUTRAL_TONE = "border-l-border";
const NEUTRAL_CHIP = "bg-muted text-muted-foreground";

function badgeLabel(readiness: SectionMeter): string {
  if (readiness.invalid > 0) return `${readiness.invalid} invalid`;
  if (readiness.incomplete > 0) return `${readiness.incomplete} to fill`;
  return "Complete";
}

export function ConfigSection({
  icon: Icon,
  title,
  description,
  readiness,
  sectionId,
  advancedLabel,
  advancedSummary,
  advanced,
  toolbar,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  readiness?: SectionMeter;
  /** Pass `null` to skip the DOM id when this block reuses another section's meter. */
  sectionId?: ConfigSectionId | null;
  advancedLabel?: string;
  advancedSummary?: string;
  advanced?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const resolvedSectionId = sectionId === null ? undefined : (sectionId ?? readiness?.id);

  return (
    <section
      id={resolvedSectionId ? `config-section-${resolvedSectionId}` : undefined}
      tabIndex={resolvedSectionId ? -1 : undefined}
      className={cn(
        "launchpad-panel scroll-mt-4 overflow-hidden rounded-lg border-l-[3px] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        readiness ? STATE_TONE[readiness.state] : NEUTRAL_TONE,
      )}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            readiness ? CHIP_TONE[readiness.state] : NEUTRAL_CHIP,
          )}
        >
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold leading-tight">{title}</h2>
            {readiness ? (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  CHIP_TONE[readiness.state],
                )}
              >
                {badgeLabel(readiness)}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {readiness ? (
          <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {readiness.requiredFilled} of {readiness.requiredTotal} required
          </span>
        ) : null}
      </header>

      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
          {toolbar}
        </div>
      ) : null}

      {children}

      {advanced ? (
        <Collapsible>
          <CollapsibleTrigger className="group flex w-full items-center gap-2 border-t border-dashed border-border bg-muted/40 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ChevronRight
              className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90"
              aria-hidden="true"
            />
            {advancedLabel ?? "Advanced"}
            {advancedSummary ? (
              <span className="ml-auto font-normal tabular-nums">{advancedSummary}</span>
            ) : null}
          </CollapsibleTrigger>
          <CollapsibleContent>{advanced}</CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}

/**
 * Hairline grid. The container is painted with the border colour and cells sit
 * on top with 1px gaps, so rows and columns align like a table instead of
 * reading as floating boxes.
 */
export function FieldGrid({
  columns = 3,
  children,
}: {
  columns?: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const columnClass = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return <div className={cn("grid grid-cols-1 gap-px bg-border", columnClass)}>{children}</div>;
}

const CELL_TONE: Record<FieldState, string> = {
  complete: "bg-card",
  optional: "bg-muted/35",
  incomplete: "bg-warning/[0.06] shadow-[inset_3px_0_0_var(--warning)]",
  invalid: "bg-destructive/[0.05] shadow-[inset_3px_0_0_var(--destructive)]",
};

const MESSAGE_TONE: Record<FieldState, string> = {
  complete: "text-muted-foreground",
  optional: "text-muted-foreground",
  incomplete: "text-warning",
  invalid: "text-destructive",
};

export function FieldCell({
  label,
  state = "complete",
  message,
  hint,
  span,
  as,
  children,
}: {
  label: string;
  state?: FieldState;
  message?: string;
  hint?: string;
  span?: 2 | 3;
  /** Use a div when the control contains buttons or nested fields. */
  as?: "label" | "div";
  children: ReactNode;
}) {
  const MessageIcon = state === "invalid" ? AlertCircle : TriangleAlert;
  const Comp = as ?? "label";
  return (
    <Comp
      className={cn(
        "block px-4 py-3",
        CELL_TONE[state],
        span === 2 && "sm:col-span-2",
        span === 3 && "sm:col-span-2 lg:col-span-3",
      )}
    >
      <span className="flex items-baseline gap-2 text-xs font-semibold">
        {label}
        {state === "optional" ? (
          <span className="font-normal text-muted-foreground">Optional</span>
        ) : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {message ? (
        <span className={cn("mt-1.5 flex items-center gap-1.5 text-xs", MESSAGE_TONE[state])}>
          {state === "incomplete" || state === "invalid" ? (
            <MessageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          {message}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </Comp>
  );
}

/** One bordered control for fields that are a single thought, such as city/state/ZIP. */
export function JoinedFields({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap overflow-hidden rounded-md border border-input bg-card sm:flex-nowrap">
      {children}
    </div>
  );
}

export function JoinedField({
  label,
  state = "complete",
  width,
  children,
}: {
  label: string;
  state?: FieldState;
  width?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "min-w-0 flex-1 border-border px-3 py-1.5 not-first:border-l",
        state === "incomplete" && "bg-warning/[0.08]",
        state === "invalid" && "bg-destructive/[0.06]",
      )}
      style={width ? { flex: `0 0 ${width}` } : undefined}
    >
      <span
        className={cn(
          "block text-xs",
          state === "incomplete"
            ? "font-semibold text-warning"
            : state === "invalid"
              ? "font-semibold text-destructive"
              : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/** Plain bordered block for sections whose body is not a field grid. */
export function SectionBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("bg-card p-4", className)}>{children}</div>;
}

export function SectionStateIcon({ state }: { state: SectionMeter["state"] }) {
  if (state === "invalid") {
    return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  }
  if (state === "incomplete") {
    return <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />;
  }
  return <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />;
}
