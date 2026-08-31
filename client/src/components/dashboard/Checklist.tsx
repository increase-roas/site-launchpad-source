import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One readiness treatment for the whole workspace. Campaign steps and launch
 * checks used to render the same idea two different ways, and details were
 * truncated, which hid the part that says what to fix.
 */

export type ChecklistState = "pass" | "fail" | "pending";

function StateIcon({ state }: { state: ChecklistState }) {
  switch (state) {
    case "pass":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />;
    case "fail":
      return <Circle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />;
    case "pending":
      return (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground/60"
          aria-hidden="true"
        />
      );
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled checklist state: ${String(exhaustive)}`);
    }
  }
}

export function ChecklistItem({
  state,
  label,
  detail,
  items,
  action,
}: {
  state: ChecklistState;
  label: string;
  detail?: string;
  /** Sub-points, such as the individual fields a section is missing. */
  items?: readonly string[];
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5">
        <StateIcon state={state} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {detail ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        ) : null}
        {items?.length ? (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
            {items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}

export function Checklist({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ul className={cn("divide-y divide-border", className)}>{children}</ul>;
}
