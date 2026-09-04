import { PageHeading } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClientsBoardToolbar } from "@/components/clients/ClientsBoardToolbar";
import {
  ClientsTable,
  ClientsTableSkeleton,
} from "@/components/clients/ClientsTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  buildClientBoard,
  DEFAULT_CLIENT_BOARD_QUERY,
  nextSortDirection,
  type ClientBoardItem,
  type ClientBoardQuery,
  type ClientSortKey,
  type ClientStatusFilter,
  type ClientThemeFilter,
} from "@/lib/clientBoard";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import {
  AlertTriangle,
  Globe,
  Plus,
  Rocket,
  SearchX,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function ClientsPage() {
  const { clients, selectedClientId, isLoading, isError, refetchClients } = useWorkspace();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [pendingDelete, setPendingDelete] = useState<ClientBoardItem | null>(null);
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: result => {
      toast.success("Client deleted.");
      setPendingDelete(null);
      void utils.clients.list.invalidate();
      refetchClients();
      if (selectedClientId === result.clientId) {
        setLocation("/clients");
      }
    },
    onError: error => toast.error(error.message),
  });
  const [board, setBoard] = useState<ClientBoardQuery>(() => {
    if (typeof window === "undefined") return DEFAULT_CLIENT_BOARD_QUERY;
    const query = new URLSearchParams(window.location.search).get("q");
    return query ? { ...DEFAULT_CLIENT_BOARD_QUERY, query } : DEFAULT_CLIENT_BOARD_QUERY;
  });

  const { visible, counts, filtered } = useMemo(
    () => buildClientBoard(clients, board),
    [clients, board],
  );

  const heading = (
    <PageHeading
      title="Clients"
      description="Manage all client websites, previews, and production environments."
      action={
        <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold">
          <Link href="/clients/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New client
          </Link>
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {heading}
        <ClientsTableSkeleton rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        {heading}
        <div className="launchpad-panel rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold">Clients could not be loaded</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Retry in a moment. If it persists the API may be unreachable.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetchClients}
            className="mt-4 h-8 text-xs font-semibold"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-3">
        {heading}
        <div className="launchpad-panel rounded-lg px-6 py-16 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <UsersRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">No clients yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Add a client with just a business name — everything else can follow.
          </p>
          <Button asChild className="mt-6 h-9 gap-1.5">
            <Link href="/clients/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add client
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {heading}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total clients" value={counts.all} icon={UsersRound} tone="primary" />
        <StatCard
          label="Live"
          value={counts.live}
          icon={Globe}
          tone="success"
          note={`${counts.all === 0 ? 0 : Math.round((counts.live / counts.all) * 100)}% of clients`}
          progress={counts.all === 0 ? 0 : (counts.live / counts.all) * 100}
        />
        <StatCard
          label="Ready to publish"
          value={counts.ready_to_publish}
          icon={Rocket}
          tone="primary"
          progress={
            counts.all === 0 ? 0 : (counts.ready_to_publish / counts.all) * 100
          }
        />
        <StatCard
          label="Needs attention"
          value={counts.issue + counts.setup_needed}
          icon={AlertTriangle}
          tone="warning"
          progress={
            counts.all === 0
              ? 0
              : ((counts.issue + counts.setup_needed) / counts.all) * 100
          }
        />
      </div>

      <ClientsBoardToolbar
        query={board.query}
        onQueryChange={query => setBoard(current => ({ ...current, query }))}
        status={board.status}
        onStatusChange={(status: ClientStatusFilter) =>
          setBoard(current => ({ ...current, status }))
        }
        theme={board.theme}
        onThemeChange={(theme: ClientThemeFilter) =>
          setBoard(current => ({ ...current, theme }))
        }
        sort={board.sort}
        onSortChange={(sort: ClientSortKey) =>
          setBoard(current => ({
            ...current,
            sort,
            direction: nextSortDirection(current, sort),
          }))
        }
        direction={board.direction}
        onDirectionToggle={() =>
          setBoard(current => ({
            ...current,
            direction: current.direction === "asc" ? "desc" : "asc",
          }))
        }
        onReset={() => setBoard(DEFAULT_CLIENT_BOARD_QUERY)}
        filtered={filtered}
        counts={counts}
        resultCount={visible.length}
      />

      {visible.length === 0 ? (
        <div className="launchpad-panel rounded-lg px-6 py-14 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold">No clients match these filters</p>
          {filtered ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 h-8 text-xs font-semibold"
              onClick={() => setBoard(DEFAULT_CLIENT_BOARD_QUERY)}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ClientsTable
          clients={visible}
          sort={board.sort}
          direction={board.direction}
          onSort={(sort: ClientSortKey) =>
            setBoard(current => ({
              ...current,
              sort,
              direction: nextSortDirection(current, sort),
            }))
          }
          onOpen={clientId => setLocation(workspaceRoute("overview", clientId))}
          onDeleteRequest={setPendingDelete}
          clientHref={clientId => workspaceRoute("overview", clientId)}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={open => {
          if (!open && !deleteClient.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.client.businessName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the client and its Launchpad configuration, media
              records, and publish history. Published Workers and GitHub
              repositories are not removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClient.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              disabled={deleteClient.isPending || !pendingDelete}
              onClick={event => {
                event.preventDefault();
                if (!pendingDelete) return;
                deleteClient.mutate({ clientId: pendingDelete.client.id });
              }}
            >
              {deleteClient.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
