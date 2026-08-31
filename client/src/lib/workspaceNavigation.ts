import { parseCampaignSearch } from "@/features/campaigns/campaignTabs";

export type WorkspaceArea =
  | "overview"
  | "configuration"
  | "pages"
  | "campaigns"
  | "integrations";

/**
 * Launch owns its own path segment rather than a workspace area, so anything
 * that routes an operator somewhere addresses this wider union.
 */
export type ClientDestination = WorkspaceArea | "launch";

/** Sub-tabs of the client configuration page, addressable with `?tab=`. */
export const CONFIGURATION_TABS = [
  "basic",
  "branding",
  "media",
  "content",
  "technical",
] as const;
export type ConfigurationTab = (typeof CONFIGURATION_TABS)[number];

export function getWorkspaceArea(location: string): WorkspaceArea {
  // `/funnels` is the pre-Campaign path and still arrives from saved links.
  if (location.includes("/campaigns") || location.includes("/funnels")) return "campaigns";
  if (location.includes("/integrations")) return "integrations";
  if (
    location.includes("/configuration") ||
    // Older links: brand & content lived at /settings and photos at /media.
    location.includes("/settings") ||
    location.includes("/media") ||
    /^\/clients\/\d+/.test(location)
  ) {
    return "configuration";
  }
  if (location.includes("/pages")) return "pages";
  return "overview";
}

export function getClientIdFromWorkspacePath(path: string): number | undefined {
  const match = /^\/(?:workspace|clients)\/(\d+)/.exec(path);
  const value = match ? Number(match[1]) : undefined;
  return value && Number.isFinite(value) ? value : undefined;
}

export function workspaceRoute(area: WorkspaceArea, clientId?: number): string {
  if (!clientId) return "/";
  switch (area) {
    case "overview":
      return `/workspace/${clientId}`;
    case "configuration":
      return `/workspace/${clientId}/configuration`;
    case "pages":
      return `/workspace/${clientId}/pages`;
    case "campaigns":
      return `/workspace/${clientId}/campaigns`;
    case "integrations":
      return `/workspace/${clientId}/integrations`;
    default: {
      const exhaustive: never = area;
      return exhaustive;
    }
  }
}

export function configurationRoute(clientId: number, tab?: ConfigurationTab): string {
  const base = workspaceRoute("configuration", clientId);
  return tab ? `${base}?tab=${tab}` : base;
}

export function integrationsRoute(clientId: number): string {
  return workspaceRoute("integrations", clientId);
}

export function campaignRoute(clientId: number, campaignId: number): string {
  return `${workspaceRoute("campaigns", clientId)}?campaign=${campaignId}`;
}

export function launchRoute(clientId: number): string {
  return `/workspace/${clientId}/launch`;
}

export function clientDestinationRoute(
  destination: ClientDestination,
  clientId: number,
): string {
  return destination === "launch"
    ? launchRoute(clientId)
    : workspaceRoute(destination, clientId);
}

export function websitePublisherRoute(clientId: number): string {
  return launchRoute(clientId);
}

export function publisherDestination(input: {
  clientId: number;
  area: WorkspaceArea;
  search?: string;
}): string {
  switch (input.area) {
    case "campaigns": {
      const parsed = parseCampaignSearch(input.search ?? "");
      const base = workspaceRoute("campaigns", input.clientId);
      return parsed.campaignId ? `${base}?campaign=${parsed.campaignId}` : base;
    }
    case "overview":
    case "pages":
    case "integrations":
    case "configuration":
      return websitePublisherRoute(input.clientId);
    default: {
      const exhaustive: never = input.area;
      return exhaustive;
    }
  }
}

/** `/clients/5`, `/workspace/5/settings` and `/workspace/5/media` all predate the configuration page. */
export function configurationRedirectFromLegacyPath(path: string): string | null {
  const legacyClient = /^\/clients\/(\d+)\/?$/.exec(path);
  if (legacyClient) return configurationRoute(Number(legacyClient[1]));
  const legacySettings = /^\/workspace\/(\d+)\/settings\/?$/.exec(path);
  if (legacySettings) return configurationRoute(Number(legacySettings[1]));
  const legacyMedia = /^\/workspace\/(\d+)\/media\/?$/.exec(path);
  if (legacyMedia) return configurationRoute(Number(legacyMedia[1]), "media");
  return null;
}

/** `/workspace/5/preview-qa` predates the merge of pre-launch checks into Launch. */
export function launchRedirectFromLegacyPath(path: string): string | null {
  const legacyPreviewQa = /^\/workspace\/(\d+)\/preview-qa\/?$/.exec(path);
  return legacyPreviewQa ? launchRoute(Number(legacyPreviewQa[1])) : null;
}

/** `/workspace/5/funnels` predates Campaigns and keeps any `?campaign=`/`?funnel=`. */
export function campaignsRedirectFromLegacyPath(
  path: string,
  search = "",
): string | null {
  const legacyFunnels = /^\/workspace\/(\d+)\/funnels\/?$/.exec(path);
  if (!legacyFunnels) return null;
  return publisherDestination({
    clientId: Number(legacyFunnels[1]),
    area: "campaigns",
    search,
  });
}
