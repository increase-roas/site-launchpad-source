import { StatusDot } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  clientStatusTone,
  filterClients,
  sortClients,
  type ClientBoardItem,
} from "@/lib/clientBoard";
import { cn } from "@/lib/utils";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

/** Keeps the sidebar list short enough that the account panel stays pinned. */
const PAGE_SIZE = 8;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ClientAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className ?? "h-8 w-8",
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

function DirectoryHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Clients
      </p>
      {count > 0 ? (
        <span className="rounded bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
      <Link
        href="/clients/new"
        aria-label="Add client"
        title="Add client"
        className="ml-auto grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * The primary way to move between clients. Ordered so the clients needing the
 * most attention surface first, which is what an operator actually scans for.
 */
export function ClientDirectory({ onNavigate }: { onNavigate?: () => void }) {
  const { clients, selectedClientId, isLoading, isError, refetchClients } =
    useWorkspace();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const visible = useMemo(
    () =>
      sortClients(
        filterClients(clients as ClientBoardItem[], query, "all"),
        "attention",
        "asc",
      ),
    [clients, query],
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const paged = visible.slice(start, start + PAGE_SIZE);

  // Following a link to a client on another page should bring that page along.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (selectedClientId == null) return;
    const index = visibleRef.current.findIndex(
      item => item.client.id === selectedClientId,
    );
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
  }, [selectedClientId]);

  if (isLoading) {
    return (
      <div className="min-h-0 px-2">
        <DirectoryHeader count={0} />
        <div className="space-y-1.5 px-0.5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-0 px-2">
        <DirectoryHeader count={0} />
        <div className="rounded-lg bg-muted/60 px-2.5 py-3 text-center">
          <AlertTriangle
            className="mx-auto h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Clients could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetchClients}
            className="mt-2 h-7 w-full text-[11px] font-semibold"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="min-h-0 px-2">
        <DirectoryHeader count={0} />
        <p className="px-2.5 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          No clients yet. Start with a business name.
        </p>
        <Button asChild size="sm" className="h-8 w-full gap-1.5 text-xs font-semibold">
          <Link href="/clients/new" onClick={onNavigate}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add client
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <DirectoryHeader count={clients.length} />

      <div className="relative px-0.5 pb-1.5">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="Search clients…"
          aria-label="Search clients by name"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Clients">
        {visible.length === 0 ? (
          <p className="px-2.5 py-3 text-[11px] text-muted-foreground">
            No clients match that search.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5 pb-1">
            {paged.map(item => {
              const selected = item.client.id === selectedClientId;
              return (
                <li key={item.client.id}>
                  <Link
                    href={workspaceRoute("overview", item.client.id)}
                    onClick={onNavigate}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                      selected
                        ? "bg-sidebar-accent"
                        : "hover:bg-muted/70",
                    )}
                  >
                    <ClientAvatar
                      name={item.client.businessName}
                      className="h-7 w-7"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[13px] font-medium leading-tight",
                          selected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {item.client.businessName}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                        {item.client.shortName}
                      </span>
                    </span>
                    <StatusDot
                      tone={clientStatusTone(item.operationalSummary.status)}
                      label={item.operationalSummary.statusLabel}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1.5">
          <span
            aria-live="polite"
            className="text-[10px] tabular-nums text-muted-foreground"
          >
            {start + 1}–{start + paged.length} of {visible.length}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous clients"
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="More clients"
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
