import { StatusBadge, StatusPill } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clientProgress,
  clientStatusTone,
  formatClientUpdatedAt,
  nextClientAction,
  type ClientBoardItem,
  type ClientSortDirection,
  type ClientSortKey,
  type ClientStatusTone,
} from "@/lib/clientBoard";
import { cn } from "@/lib/utils";
import {
  clientDestinationRoute,
  configurationRoute,
  workspaceRoute,
} from "@/lib/workspaceNavigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Link } from "wouter";

const PROGRESS_CLASSES: Record<ClientStatusTone, string> = {
  live: "[&>[data-slot=progress-indicator]]:bg-success",
  ready: "[&>[data-slot=progress-indicator]]:bg-primary",
  publishing: "[&>[data-slot=progress-indicator]]:bg-info",
  attention: "[&>[data-slot=progress-indicator]]:bg-warning",
  critical: "[&>[data-slot=progress-indicator]]:bg-destructive",
};

type SortableColumn = {
  key: ClientSortKey;
  label: string;
  className?: string;
};

const COLUMNS: SortableColumn[] = [
  { key: "name", label: "Client" },
  { key: "attention", label: "Status", className: "w-36" },
  { key: "progress", label: "Setup", className: "w-40" },
  { key: "updated", label: "Last updated", className: "w-40" },
];

const STATIC_COLUMNS: { label: string; className: string; srOnly?: boolean }[] = [
  { label: "Credentials", className: "w-36" },
  { label: "Next step", className: "w-56" },
  { label: "Live site", className: "w-24" },
  { label: "Actions", className: "w-32 text-right", srOnly: true },
];

type ClientsTableProps = {
  clients: ClientBoardItem[];
  sort: ClientSortKey;
  direction: ClientSortDirection;
  onSort: (sort: ClientSortKey) => void;
  onOpen: (clientId: number) => void;
  clientHref: (clientId: number) => string;
};

export function ClientsTable({
  clients,
  sort,
  direction,
  onSort,
  onOpen,
  clientHref,
}: ClientsTableProps) {
  const handleRowClick = (
    event: MouseEvent<HTMLTableRowElement>,
    clientId: number,
  ) => {
    if (event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    onOpen(clientId);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {COLUMNS.map(column => {
              const active = sort === column.key;
              return (
                <TableHead
                  key={column.key}
                  className={cn("px-4", column.className)}
                  aria-sort={
                    active
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {column.label}
                    {active ? (
                      direction === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </TableHead>
              );
            })}
            {STATIC_COLUMNS.map(column => (
              <TableHead
                key={column.label}
                className={cn(
                  "px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  column.className,
                )}
              >
                {column.srOnly ? (
                  <span className="sr-only">{column.label}</span>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(({ client, operationalSummary }) => {
            const tone = clientStatusTone(operationalSummary.status);
            const progress = clientProgress(operationalSummary);
            const runtime = operationalSummary.runtimeConfiguration;
            const action = nextClientAction(operationalSummary);
            return (
              <TableRow
                key={client.id}
                onClick={event => handleRowClick(event, client.id)}
                className="group cursor-pointer border-border"
              >
                <TableCell className="px-4 py-3">
                  <a
                    href={clientHref(client.id)}
                    onClick={event => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.button !== 0
                      ) {
                        return;
                      }
                      event.preventDefault();
                      onOpen(client.id);
                    }}
                    className="block max-w-[18rem] truncate rounded font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={client.businessName}
                  >
                    {client.businessName}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.shortName}
                  </p>
                </TableCell>

                <TableCell className="px-4 py-3">
                  <StatusPill tone={tone} label={operationalSummary.statusLabel} />
                </TableCell>

                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Progress
                      value={progress.percent}
                      className={cn("h-1.5 w-20 bg-muted", PROGRESS_CLASSES[tone])}
                    />
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {progress.complete}/{progress.total}
                    </span>
                  </div>
                </TableCell>

                <TableCell
                  className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground"
                  title={
                    client.updatedAt
                      ? formatClientUpdatedAt(client.updatedAt)
                      : undefined
                  }
                >
                  {formatClientUpdatedAt(client.updatedAt)}
                </TableCell>

                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {runtime.set}/{runtime.total}
                    </span>
                    {runtime.blocksLaunch ? (
                      <span
                        title={`Missing: ${runtime.requiredMissing.join(", ")}`}
                        className="min-w-0"
                      >
                        <StatusBadge
                          tone="danger"
                          dot
                          label={`${runtime.requiredMissing.length} missing`}
                        />
                      </span>
                    ) : (
                      <StatusBadge tone="success" dot label="Ready" />
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-4 py-3">
                  <p
                    className="truncate text-xs font-medium text-foreground"
                    title={action.detail}
                  >
                    {action.label}
                  </p>
                </TableCell>

                <TableCell className="px-4 py-3">
                  {operationalSummary.liveUrl ? (
                    <a
                      href={operationalSummary.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded text-xs font-semibold text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Visit
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span
                      className="text-xs text-muted-foreground"
                      aria-label="No live site yet"
                    >
                      —
                    </span>
                  )}
                </TableCell>

                <TableCell className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px] font-semibold"
                    >
                      <Link href={clientDestinationRoute(action.destination, client.id)}>
                        Continue
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label={`More actions for ${client.businessName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={workspaceRoute("overview", client.id)}>
                            Overview
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={configurationRoute(client.id)}>
                            Configuration
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={configurationRoute(client.id, "media")}>
                            Media
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={workspaceRoute("pages", client.id)}>Pages</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={workspaceRoute("integrations", client.id)}>
                            Integrations
                          </Link>
                        </DropdownMenuItem>
                        {operationalSummary.liveUrl ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a
                                href={operationalSummary.liveUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink
                                  className="mr-2 h-4 w-4"
                                  aria-hidden="true"
                                />
                                Open live site
                              </a>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ClientsTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy="true"
      aria-label="Loading clients"
    >
      <div className="h-10 border-b border-border bg-muted/40" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
        >
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-1.5 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
