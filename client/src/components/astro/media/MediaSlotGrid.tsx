import { cn } from "@/lib/utils";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import {
  MEDIA_GROUP_DESCRIPTIONS,
  MEDIA_GROUP_LABELS,
  countAddedByGroup,
  groupMediaSlots,
  type ResolvedMediaSlot,
} from "./mediaSlots";

export function MediaSlotGrid({
  slots,
  selectedId,
  busySlotId,
  onSelect,
}: {
  slots: ResolvedMediaSlot[];
  selectedId: string;
  busySlotId: string | null;
  onSelect: (slotId: string) => void;
}) {
  const counts = countAddedByGroup(slots);

  return (
    <div className="space-y-3">
      {groupMediaSlots(slots).map(({ group, slots: groupSlots }) => {
        const { added, total } = counts[group];
        return (
          <section key={group} className="launchpad-panel overflow-hidden rounded-lg">
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight">{MEDIA_GROUP_LABELS[group]}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {MEDIA_GROUP_DESCRIPTIONS[group]}
                </p>
              </div>
              <span
                className={cn(
                  "ml-auto shrink-0 text-xs font-semibold tabular-nums",
                  added === total ? "text-success" : "text-warning",
                )}
              >
                {added} of {total}
              </span>
            </header>

            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                        "group w-full overflow-hidden rounded-md border text-left transition-colors",
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : slot.added
                            ? "border-border hover:border-primary/50"
                            : "border-dashed border-border hover:border-primary/50",
                      )}
                    >
                      <span className="relative block aspect-[16/10] bg-muted">
                        {slot.image ? (
                          <img
                            src={slot.image.storageUrl}
                            alt={`${slot.label} preview`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                            {busy ? (
                              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                            ) : (
                              <ImagePlus className="h-5 w-5" aria-hidden="true" />
                            )}
                            <span className="text-xs font-medium">
                              {busy ? "Uploading…" : "Add photo"}
                            </span>
                          </span>
                        )}
                        {slot.image && busy ? (
                          <span className="absolute inset-0 grid place-items-center bg-background/70">
                            <Loader2
                              className="h-5 w-5 animate-spin text-muted-foreground"
                              aria-hidden="true"
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2 border-t border-border bg-card px-2.5 py-2">
                        {slot.added ? (
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
                        <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">
                          {slot.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
