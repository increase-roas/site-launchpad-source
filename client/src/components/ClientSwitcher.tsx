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
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { StatusDot } from "./StatusDot";

function clientState(status: "draft" | "ready" | "live" | "issue") {
  if (status === "live") return { tone: "green" as const, label: "Live" };
  if (status === "issue") return { tone: "red" as const, label: "Issues" };
  return { tone: "yellow" as const, label: "In progress" };
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
  const { clients, selectedClient, isLoading } = useWorkspace();
  const selectedState = selectedClient ? clientState(selectedClient.client.status) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          className={cn(
            "h-12 justify-between rounded-xl border-white/10 bg-white/[0.035] px-3 hover:bg-white/[0.07]",
            compact ? "w-[190px]" : "w-full",
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-extrabold">
                {selectedClient?.client.businessName ?? (clients.length ? "Choose client" : "No clients yet")}
              </span>
              {selectedState ? (
                <span className="mt-0.5 block">
                  <StatusDot good={selectedState.tone === "green"} tone={selectedState.tone} label={selectedState.label} compact />
                </span>
              ) : null}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-white/10 bg-popover p-2">
        <DropdownMenuLabel className="px-2 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
          Switch client
        </DropdownMenuLabel>
        {clients.map(view => {
          const state = clientState(view.client.status);
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
                <span className="block truncate text-sm font-extrabold">{view.client.businessName}</span>
                <span className="text-xs font-semibold text-muted-foreground">{state.label}</span>
              </span>
              {selected ? <Check className="ml-2 h-4 w-4 text-cyan-300" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="my-2 bg-white/8" />
        <DropdownMenuItem onSelect={onAddClient} className="min-h-12 cursor-pointer rounded-lg px-3 font-extrabold text-cyan-300">
          <Plus className="mr-2 h-4 w-4" />
          Add new client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
