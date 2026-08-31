import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Reference material that should stay reachable without occupying the page. */
export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  children,
  bodyClassName,
}: {
  title: string;
  /** Short right-aligned summary, so the value is legible while collapsed. */
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="launchpad-panel overflow-hidden rounded-lg">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{title}</span>
        {meta ? (
          <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn("border-t border-border p-4", bodyClassName)}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
