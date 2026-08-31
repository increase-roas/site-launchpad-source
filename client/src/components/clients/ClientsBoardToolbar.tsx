import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLIENT_STATUS_ORDER,
  CLIENT_THEME_ORDER,
  clientStatusFilterLabel,
  clientThemeFilterLabel,
  type ClientSortDirection,
  type ClientSortKey,
  type ClientStatusCounts,
  type ClientStatusFilter,
  type ClientThemeFilter,
} from "@/lib/clientBoard";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

const STATUS_FILTERS: ClientStatusFilter[] = ["all", ...CLIENT_STATUS_ORDER];
const THEME_FILTERS: ClientThemeFilter[] = ["all", ...CLIENT_THEME_ORDER];

const SORT_LABELS: Record<ClientSortKey, string> = {
  attention: "Needs attention",
  name: "Name",
  progress: "Setup progress",
  updated: "Last updated",
};

const SORT_KEYS: ClientSortKey[] = ["attention", "updated", "name", "progress"];

type ClientsBoardToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  status: ClientStatusFilter;
  onStatusChange: (status: ClientStatusFilter) => void;
  theme: ClientThemeFilter;
  onThemeChange: (theme: ClientThemeFilter) => void;
  sort: ClientSortKey;
  onSortChange: (sort: ClientSortKey) => void;
  direction: ClientSortDirection;
  onDirectionToggle: () => void;
  onReset: () => void;
  filtered: boolean;
  counts: ClientStatusCounts;
  resultCount: number;
};

export function ClientsBoardToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  theme,
  onThemeChange,
  sort,
  onSortChange,
  direction,
  onDirectionToggle,
  onReset,
  filtered,
  counts,
  resultCount,
}: ClientsBoardToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const typingElsewhere =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (typingElsewhere) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape" && query !== "") {
                event.preventDefault();
                onQueryChange("");
              }
            }}
            placeholder="Search clients…"
            aria-label="Search clients by name"
            aria-describedby="clients-search-hint"
            className="h-9 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query === "" ? (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] font-semibold text-muted-foreground sm:block">
              /
            </kbd>
          ) : (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <Select
          value={status}
          onValueChange={value => onStatusChange(value as ClientStatusFilter)}
        >
          <SelectTrigger size="sm" className="h-9 min-w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {STATUS_FILTERS.map(filter => (
              <SelectItem
                key={filter}
                value={filter}
                disabled={filter !== "all" && counts[filter] === 0}
              >
                {clientStatusFilterLabel(filter)}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {counts[filter]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={theme}
          onValueChange={value => onThemeChange(value as ClientThemeFilter)}
        >
          <SelectTrigger size="sm" className="h-9 min-w-36" aria-label="Filter by theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {THEME_FILTERS.map(filter => (
              <SelectItem key={filter} value={filter}>
                {clientThemeFilterLabel(filter)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 text-xs font-semibold"
            >
              Clear filters
            </Button>
          ) : null}

          <Select
            value={sort}
            onValueChange={value => onSortChange(value as ClientSortKey)}
          >
            <SelectTrigger size="sm" className="h-9 min-w-48" aria-label="Sort clients">
              <span className="text-muted-foreground">Sort by:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_KEYS.map(key => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDirectionToggle}
            className="h-9 w-9 p-0"
            aria-label={
              direction === "asc"
                ? "Sorted ascending. Switch to descending"
                : "Sorted descending. Switch to ascending"
            }
            title={direction === "asc" ? "Ascending" : "Descending"}
          >
            {direction === "asc" ? (
              <ArrowUpNarrowWide className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <p
        id="clients-search-hint"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {resultCount === counts.all
          ? `${counts.all} ${counts.all === 1 ? "client" : "clients"}`
          : `${resultCount} of ${counts.all} clients`}
      </p>
    </div>
  );
}
