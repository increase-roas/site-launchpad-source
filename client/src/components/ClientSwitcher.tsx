import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { clientSwitcherLabel } from "@/lib/queryErrors";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { StatusDot } from "./StatusDot";

function clientState(view: {
  client: { status: "draft" | "ready" | "live" | "issue" };
  operationalSummary?: { status: "setup_needed" | "ready_to_publish" | "publishing" | "live" | "issue"; statusLabel: string };
}) {
  const status = view.operationalSummary?.status;
  if (status === "live") return { tone: "green" as const, label: "Live" };
  if (status === "issue") return { tone: "red" as const, label: "Issue" };
  if (status === "publishing") return { tone: "yellow" as const, label: "Publishing" };
  if (status === "ready_to_publish") return { tone: "green" as const, label: "Ready to publish" };
  if (status === "setup_needed") return { tone: "yellow" as const, label: "Setup needed" };
  if (view.client.status === "live") return { tone: "green" as const, label: "Live" };
  if (view.client.status === "issue") return { tone: "red" as const, label: "Issue" };
  return { tone: "yellow" as const, label: "Setup needed" };
}

export function ClientSwitcher({
  compact = false,
  onSelect,
  onAddClient,
}: {
  compact?: boolean;
  onSelect: (clientId: number) => void;
  onAddClient: () => void;
}) {
  const { clients, selectedClient, isLoading, isError } = useWorkspace();
  const selectedState = selectedClient ? clientState(selectedClient) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          className={cn(
            "justify-between border-border bg-card px-2.5 hover:bg-accent",
            compact ? "h-9 w-[150px] rounded-md sm:w-[210px]" : "h-11 w-full rounded-md",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("grid shrink-0 place-items-center bg-primary/8 text-primary", compact ? "h-6 w-6 rounded" : "h-8 w-8 rounded-md")}>
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-xs font-semibold sm:text-sm">
                {clientSwitcherLabel({
                  selectedName: selectedClient?.client.businessName,
                  clientCount: clients.length,
                  isError,
                })}
              </span>
              {selectedState && !compact ? (
                <span className="mt-0.5 block">
                  <StatusDot good={selectedState.tone === "green"} tone={selectedState.tone} label={selectedState.label} compact />
                </span>
              ) : null}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 border-border bg-popover p-1.5 shadow-lg">
        <DropdownMenuLabel className="px-2 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
          Switch client
        </DropdownMenuLabel>
        {clients.map(view => {
          const state = clientState(view);
          const selected = selectedClient?.client.id === view.client.id;
          return (
            <DropdownMenuItem
              key={view.client.id}
              onSelect={() => onSelect(view.client.id)}
              className="min-h-14 cursor-pointer rounded-lg px-3"
            >
              <span
                className={`mr-3 h-3 w-3 shrink-0 rounded-full ${
                  state.tone === "green"
                    ? "bg-emerald-400"
                    : state.tone === "yellow"
                      ? "bg-amber-400"
                      : "bg-red-500"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{view.client.businessName}</span>
                <span className="text-xs font-semibold text-muted-foreground">{state.label}</span>
              </span>
              {selected ? <Check className="ml-2 h-4 w-4 text-cyan-300" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="my-1.5 bg-border" />
        <DropdownMenuItem onSelect={onAddClient} className="min-h-10 cursor-pointer rounded-md px-3 font-semibold text-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add new client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
