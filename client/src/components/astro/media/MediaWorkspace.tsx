import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import { validateImageMetadata } from "@shared/mediaSpecifications";
import { ImagePlus, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaCopyFields } from "./MediaCopyFields";
import { MediaSlotDetail } from "./MediaSlotDetail";
import {
  MEDIA_FILTER_LABELS,
  MEDIA_FILTER_VALUES,
  buildMediaBrowseEntries,
  filterMediaBrowseEntries,
  firstMissingSlotId,
  nextMissingSlotId,
  type MediaBrowseEntry,
  type MediaFilter,
  type ResolvedMediaSlot,
} from "./mediaSlots";

export function MediaWorkspace({
  slots,
  libraryItems,
  busySlotId,
  libraryBusy,
  onAddFiles,
  onUploadToSlot,
  onRemoveSlot,
  onAssign,
  onSaveCopy,
  onDeleteLibraryItem,
}: {
  slots: ResolvedMediaSlot[];
  libraryItems: MediaLibraryItemView[];
  busySlotId: string | null;
  libraryBusy: boolean;
  onAddFiles: (files: File[]) => void;
  onUploadToSlot: (slot: ResolvedMediaSlot, file: File) => void;
  onRemoveSlot: (slot: ResolvedMediaSlot) => void;
  onAssign: (slot: ResolvedMediaSlot, itemId: number) => void;
  onSaveCopy: (itemId: number, next: { alt: string; description: string }) => void;
  onDeleteLibraryItem: (itemId: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedId, setSelectedId] = useState<string>(() => firstMissingSlotId(slots) ?? slots[0]?.id ?? "");

  const entries = useMemo(
    () => buildMediaBrowseEntries(slots, libraryItems),
    [libraryItems, slots],
  );
  const visible = useMemo(
    () => filterMediaBrowseEntries(entries, query, filter),
    [entries, filter, query],
  );
  const selected = visible.find(entry => entry.id === selectedId) ?? visible[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const missingCount = slots.filter(slot => !slot.added).length;
  const addedCount = slots.filter(slot => slot.added).length;
  const selectedSlot = selected?.kind === "slot" ? selected.slot : null;
  const nextMissingId = selectedSlot ? nextMissingSlotId(slots, selectedSlot.id) : firstMissingSlotId(slots);
  const nextMissingLabel = slots.find(slot => slot.id === nextMissingId)?.label ?? null;
  const busy = selectedSlot != null && busySlotId === selectedSlot.id ? true : libraryBusy;

  return (
    <section className="launchpad-panel overflow-hidden rounded-lg">
      <div className="grid items-start md:grid-cols-[minmax(16rem,34%)_minmax(0,1fr)]">
        <div className="flex flex-col border-border md:border-r">
          <header className="space-y-2.5 border-b border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight">Photos</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {addedCount} of {slots.length} placements filled
                  {missingCount > 0 ? ` · ${missingCount} still needed` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={libraryBusy}
                onClick={() => inputRef.current?.click()}
                className="ml-auto h-8 gap-1.5 text-xs font-semibold"
              >
                {libraryBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
                Add photos
              </Button>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search photos, placements, or alt text"
                className="h-8 pl-8 text-xs"
              />
            </label>
            <div role="tablist" aria-label="Photo filters" className="flex flex-wrap gap-1.5">
              {MEDIA_FILTER_VALUES.map(value => {
                const count = filterMediaBrowseEntries(entries, query, value).length;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                      filter === value
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {MEDIA_FILTER_LABELS[value]}
                    <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </header>

          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.trim()
                ? "No photos match that search."
                : filter === "library"
                  ? "Every photo is already placed. Add a photo to keep extras here."
                  : "Add a photo to get started."}
            </p>
          ) : (
            <div className="overflow-y-auto md:max-h-[calc(100vh-16rem)]">
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {visible.map(entry => (
                  <BrowseCard
                    key={entry.id}
                    entry={entry}
                    selected={entry.id === selected?.id}
                    busy={entry.kind === "slot" && busySlotId === entry.slot.id}
                    onSelect={() => setSelectedId(entry.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {selected?.kind === "slot" ? (
            <MediaSlotDetail
              slot={selected.slot}
              busy={busy}
              embedded
              nextMissingLabel={nextMissingLabel}
              libraryItems={libraryItems}
              onFile={file => onUploadToSlot(selected.slot, file)}
              onNextMissing={() => {
                if (nextMissingId) setSelectedId(nextMissingId);
              }}
              onRemove={() => onRemoveSlot(selected.slot)}
              onAssign={itemId => onAssign(selected.slot, itemId)}
              onSaveCopy={next => {
                if (selected.slot.image?.mediaItemId) onSaveCopy(selected.slot.image.mediaItemId, next);
              }}
            />
          ) : selected?.kind === "library" ? (
            <LibraryInspector
              item={selected.item}
              slots={slots}
              busy={libraryBusy}
              onSaveCopy={next => onSaveCopy(selected.item.id, next)}
              onDelete={() => onDeleteLibraryItem(selected.item.id)}
              onAssign={slot => {
                onAssign(slot, selected.item.id);
                setSelectedId(slot.id);
              }}
            />
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Select a photo to edit it.
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={libraryBusy}
        onChange={event => {
          onAddFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}

function BrowseCard({
  entry,
  selected,
  busy,
  onSelect,
}: {
  entry: MediaBrowseEntry;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const imageUrl = entry.kind === "slot" ? entry.slot.image?.storageUrl : entry.item.storageUrl;
  const label = entry.kind === "slot" ? entry.slot.label : entry.item.alt || entry.item.filename;
  const caption = entry.kind === "slot" ? MEDIA_FILTER_LABELS[entry.slot.group] : "Library";
  const missing = entry.kind === "slot" && !entry.slot.added;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "overflow-hidden rounded-md border text-left transition-colors",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-foreground/20",
      )}
    >
      <span className="relative block aspect-[4/3] bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-[10px] font-semibold text-muted-foreground">
            {busy ? "…" : "Empty"}
          </span>
        )}
        {entry.kind === "slot" && entry.slot.required && missing ? (
          <span className="absolute top-1 right-1 rounded bg-warning/90 px-1 py-px text-[9px] font-bold text-white">
            Need
          </span>
        ) : null}
      </span>
      <span className="block px-1.5 py-1">
        <span className="block truncate text-[11px] font-medium leading-tight">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{caption}</span>
      </span>
    </button>
  );
}

function LibraryInspector({
  item,
  slots,
  busy,
  onSaveCopy,
  onDelete,
  onAssign,
}: {
  item: MediaLibraryItemView;
  slots: ResolvedMediaSlot[];
  busy: boolean;
  onSaveCopy: (next: { alt: string; description: string }) => void;
  onDelete: () => void;
  onAssign: (slot: ResolvedMediaSlot) => void;
}) {
  const compatible = slots.filter(slot => (
    validateImageMetadata(
      {
        mimeType: item.mimeType,
        sizeBytes: item.byteSize,
        width: item.width,
        height: item.height,
      },
      slot.specification,
    ) === null
  ));

  return (
    <div className="border-t border-border md:border-t-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <h3 className="text-sm font-semibold">{item.alt || item.filename}</h3>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          Library
        </span>
      </div>
      <div className="mx-3 overflow-hidden rounded-lg border border-border bg-muted">
        <img
          src={item.storageUrl}
          alt={item.alt || item.filename}
          className="mx-auto max-h-48 w-full object-contain p-2"
        />
      </div>
      <div className="flex flex-wrap items-start gap-3 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {item.filename} · {Math.max(1, Math.round(item.byteSize / 1024))} KB
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onDelete}
          className="h-8 text-xs font-semibold text-destructive"
        >
          Remove
        </Button>
      </div>
      <div className="px-3 pb-3">
        <MediaCopyFields
          alt={item.alt}
          description={item.description}
          disabled={busy}
          onSave={onSaveCopy}
        />
      </div>
      {compatible.length > 0 ? (
        <div className="border-t border-border px-3 py-2.5">
          <p className="text-xs font-semibold">Use as a placement</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {compatible.map(slot => (
              <Button
                key={slot.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAssign(slot)}
                className="h-7 text-xs font-semibold"
              >
                {slot.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
