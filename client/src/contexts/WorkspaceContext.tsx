import { trpc } from "@/lib/trpc";
import { getClientIdFromWorkspacePath } from "@/lib/workspaceNavigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type ClientView = inferRouterOutputs<AppRouter>["clients"]["list"][number];

type WorkspaceContextValue = {
  clients: ClientView[];
  selectedClientId?: number;
  selectedClient?: ClientView;
  selectClient: (clientId: number) => void;
  isLoading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = "site-launchpad-selected-client";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const clientsQuery = trpc.clients.list.useQuery();
  const clients = clientsQuery.data ?? [];
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const value = saved ? Number(saved) : undefined;
    return value && Number.isFinite(value) ? value : undefined;
  });
  const routeClientId = useMemo(() => getClientIdFromWorkspacePath(location), [location]);

  useEffect(() => {
    if (!routeClientId || routeClientId === selectedClientId) return;
    setSelectedClientId(routeClientId);
    localStorage.setItem(STORAGE_KEY, String(routeClientId));
  }, [routeClientId, selectedClientId]);

  useEffect(() => {
    if (clients.length === 0) return;
    if (selectedClientId && clients.some(view => view.client.id === selectedClientId)) return;
    const firstClientId = clients[0].client.id;
    setSelectedClientId(firstClientId);
    localStorage.setItem(STORAGE_KEY, String(firstClientId));
  }, [clients, selectedClientId]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      clients,
      selectedClientId,
      selectedClient: clients.find(view => view.client.id === selectedClientId),
      selectClient: clientId => {
        setSelectedClientId(clientId);
        localStorage.setItem(STORAGE_KEY, String(clientId));
      },
      isLoading: clientsQuery.isLoading,
    }),
    [clients, clientsQuery.isLoading, selectedClientId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
