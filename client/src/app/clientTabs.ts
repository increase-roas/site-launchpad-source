import { CAMPAIGNS_DEFERRED } from "@/lib/deferredFeatures";
import {
  launchRoute,
  workspaceRoute,
  type WorkspaceArea,
} from "@/lib/workspaceNavigation";
import type { SectionAvailability } from "./navigation";

/**
 * Client-detail tabs, in build order. Every client page has exactly one tab:
 * brand, photos and content are sub-tabs of Configuration rather than
 * destinations of their own, and pre-launch checks belong to Launch.
 */
export const CLIENT_TABS = [
  "overview",
  "configuration",
  "pages",
  "inventory",
  "campaigns",
  "integrations",
  "launch",
] as const;

export type ClientTab = (typeof CLIENT_TABS)[number];

export type ClientTabDefinition = {
  tab: ClientTab;
  label: string;
  availability: SectionAvailability;
  /** Existing workspace area this tab maps onto, when one exists. */
  area?: WorkspaceArea;
};

export const CLIENT_TAB_DEFINITIONS: Record<ClientTab, ClientTabDefinition> = {
  overview: {
    tab: "overview",
    label: "Overview",
    availability: "active",
    area: "overview",
  },
  configuration: {
    tab: "configuration",
    label: "Configuration",
    availability: "active",
    area: "configuration",
  },
  pages: {
    tab: "pages",
    label: "Pages",
    availability: "active",
    area: "pages",
  },
  inventory: {
    tab: "inventory",
    label: "Inventory",
    availability: "active",
    area: "inventory",
  },
  campaigns: {
    tab: "campaigns",
    label: "Campaigns",
    availability: CAMPAIGNS_DEFERRED ? "deferred" : "active",
    area: "campaigns",
  },
  integrations: {
    tab: "integrations",
    label: "Integrations",
    availability: "active",
    area: "integrations",
  },
  launch: {
    tab: "launch",
    label: "Launch",
    availability: "active",
  },
};

export const CLIENT_TAB_LIST: ClientTabDefinition[] = CLIENT_TABS.map(
  tab => CLIENT_TAB_DEFINITIONS[tab],
);

export function clientTabHref(tab: ClientTab, clientId: number): string {
  const definition = CLIENT_TAB_DEFINITIONS[tab];
  if (definition.area) return workspaceRoute(definition.area, clientId);
  return launchRoute(clientId);
}

/** Tabs without a workspace area own their own path segment. */
export function getClientTab(location: string, area: WorkspaceArea): ClientTab {
  const [pathname] = location.split("?");
  // `/preview-qa` is the retired checks page, now part of Launch.
  if (pathname.endsWith("/launch") || pathname.endsWith("/preview-qa")) return "launch";
  switch (area) {
    case "configuration":
      return "configuration";
    case "pages":
      return "pages";
    case "inventory":
      return "inventory";
    case "campaigns":
      return "campaigns";
    case "integrations":
      return "integrations";
    case "overview":
      return "overview";
    default: {
      const exhaustive: never = area;
      return exhaustive;
    }
  }
}
