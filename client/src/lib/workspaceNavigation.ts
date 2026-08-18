import { parsePaidAdsFunnelSearch } from "@shared/paidFunnel/library";

export type WorkspaceArea = "clients" | "pages" | "funnels" | "media" | "settings";

export function getWorkspaceArea(location: string): WorkspaceArea {
  if (location.includes("/funnels")) return "funnels";
  if (location.includes("/media")) return "media";
  if (location.includes("/integrations") || location.includes("/settings") || /^\/clients\/\d+/.test(location)) return "settings";
  if (location.includes("/pages")) return "pages";
  return "clients";
}

export function getClientIdFromWorkspacePath(path: string): number | undefined {
  const match = /^\/(?:workspace|clients)\/(\d+)/.exec(path);
  const value = match ? Number(match[1]) : undefined;
  return value && Number.isFinite(value) ? value : undefined;
}

export function workspaceRoute(area: WorkspaceArea, clientId?: number): string {
  if (area === "clients" || !clientId) return "/";
  if (area === "pages") return `/workspace/${clientId}/pages`;
  if (area === "funnels") return `/workspace/${clientId}/funnels`;
  if (area === "media") return `/workspace/${clientId}/media`;
  return `/workspace/${clientId}/settings`;
}

export function integrationsRoute(clientId: number): string {
  return `/workspace/${clientId}/integrations`;
}

export function websitePublisherRoute(clientId: number): string {
  return `/workspace/${clientId}/settings`;
}

export function publisherDestination(input: {
  clientId: number;
  area: WorkspaceArea;
  search?: string;
}): string {
  if (input.area === "funnels") {
    const parsed = parsePaidAdsFunnelSearch(input.search ?? "");
    if (parsed.funnelId) {
      return `/workspace/${input.clientId}/funnels?funnel=${parsed.funnelId}`;
    }
    if (parsed.studioKey) {
      return `/workspace/${input.clientId}/funnels?studio=${encodeURIComponent(parsed.studioKey)}`;
    }
    return workspaceRoute("funnels", input.clientId);
  }
  return websitePublisherRoute(input.clientId);
}

export function settingsRedirectFromLegacyClientPath(path: string): string | null {
  const match = /^\/clients\/(\d+)\/?$/.exec(path);
  return match ? `/workspace/${match[1]}/settings` : null;
}
