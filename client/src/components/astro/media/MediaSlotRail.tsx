import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import {
  MEDIA_GROUP_LABELS,
  countAddedByGroup,
  groupMediaSlots,
  type ResolvedMediaSlot,
} from "./mediaSlots";

export function MediaSlotRail({
  slots,
  selectedId,
  busySlotId,
  onSelect,
  className,
}: {
  slots: ResolvedMediaSlot[];
  selectedId: string;
  busySlotId: string | null;
  onSelect: (slotId: string) => void;
  className?: string;
}) {
  const counts = countAddedByGroup(slots);
  const added = slots.filter(slot => slot.added).length;

  return (
    <div className={cn("launchpad-panel flex flex-col overflow-hidden rounded-lg", className)}>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold leading-tight">Images</h2>
        <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
          {added} of {slots.length}
        </span>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Image slots" className="pb-2">
          {groupMediaSlots(slots).map(({ group, slots: groupSlots }) => {
            const { added: groupAdded, total } = counts[group];
            return (
              <div key={group}>
                <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-card/95 px-3 pt-3 pb-1.5 backdrop-blur">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {MEDIA_GROUP_LABELS[group]}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-xs font-semibold tabular-nums",
                      groupAdded === total ? "text-success" : "text-warning",
                    )}
                  >
                    {groupAdded}/{total}
                  </span>
                </div>
                <ul>
                  {groupSlots.map(slot => {
                    const selected = slot.id === selectedId;
                    const busy = slot.id === busySlotId;
                    return (
                      <li key={slot.id}>
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          onClick={() => onSelect(slot.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                            selected
                              ? "bg-primary/[0.08] shadow-[inset_3px_0_0_var(--primary)]"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-muted">
                            {slot.image ? (
                              <img
                                src={slot.image.storageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon
                                className="h-3.5 w-3.5 text-muted-foreground/60"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs leading-tight",
                              selected ? "font-semibold text-foreground" : "text-foreground/90",
                            )}
                          >
                            {slot.label}
                          </span>
                          {busy ? (
                            <Loader2
                              className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                              aria-label="Uploading"
                            />
                          ) : slot.added ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Added" />
                          ) : (
                            <span
                              aria-label={slot.required ? "Required, missing" : "Missing"}
                              className={cn(
                                "block h-2 w-2 shrink-0 rounded-full",
                                slot.required ? "bg-warning" : "bg-muted-foreground/40",
                              )}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
