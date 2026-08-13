export type WorkspaceArea = "clients" | "pages" | "funnels" | "media" | "settings";

export function getWorkspaceArea(location: string): WorkspaceArea {
  if (location.includes("/funnels")) return "funnels";
  if (location.includes("/media")) return "media";
  if (location.includes("/settings") || /^\/clients\/\d+/.test(location)) return "settings";
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
