import { THEME_VALUES, type ThemeValue } from "@shared/client";
import {
  OPERATIONAL_STATUS_LABELS,
  type OperationalStatus,
  type OperationalSummary,
  type OperationalSummaryItem,
  type OperationalSummaryKey,
} from "@shared/operationalSummary";
import { CAMPAIGNS_DEFERRED } from "./deferredFeatures";
import type { ClientDestination } from "./workspaceNavigation";

/** Readiness items only a campaign can complete. */
const CAMPAIGN_SUMMARY_KEYS: readonly OperationalSummaryKey[] = [
  "funnelIntegrations",
  "funnelsLive",
];

/**
 * What a client is measured on. The server keeps reporting campaign readiness
 * because it is true, but while campaigns are deferred it is dropped here so no
 * client sits permanently short of a step that cannot be worked on.
 */
export function trackedOperationalItems(
  summary: OperationalSummary,
): OperationalSummaryItem[] {
  if (!CAMPAIGNS_DEFERRED) return [...summary.items];
  return summary.items.filter(item => !CAMPAIGN_SUMMARY_KEYS.includes(item.key));
}

export type ClientBoardItem = {
  client: {
    id: number;
    businessName: string;
    shortName: string;
    theme?: string | null;
    updatedAt?: Date | string | null;
  };
  operationalSummary: OperationalSummary;
};

/** Ordered so the clients needing the most attention rank first. */
export const CLIENT_STATUS_ORDER = [
  "issue",
  "setup_needed",
  "publishing",
  "ready_to_publish",
  "live",
] as const satisfies readonly OperationalStatus[];

export type ClientStatusFilter = OperationalStatus | "all";
export type ClientThemeFilter = ThemeValue | "all";
export type ClientSortKey = "attention" | "name" | "progress" | "updated";
export type ClientSortDirection = "asc" | "desc";

export const CLIENT_THEME_ORDER = THEME_VALUES;

export const CLIENT_THEME_LABELS: Record<ThemeValue, string> = {
  aqua: "Aqua",
  luxury: "Luxury",
  natural: "Natural",
  mono: "Mono",
};

export function clientThemeFilterLabel(filter: ClientThemeFilter): string {
  return filter === "all" ? "All themes" : CLIENT_THEME_LABELS[filter];
}

/** Null when a client carries no theme, or one this build does not know. */
export function clientThemeLabel(theme: string | null | undefined): string | null {
  return THEME_VALUES.includes(theme as ThemeValue)
    ? CLIENT_THEME_LABELS[theme as ThemeValue]
    : null;
}

export function isFactoryPlaceholderUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "example.com" || host.endsWith(".example.com");
  } catch {
    return true;
  }
}

/**
 * Temporary factory preview only. A published Worker — including leftover
 * paid-funnel jobs — is not a preview of the unpublished website.
 */
export function clientPreviewHref(input: {
  liveUrl?: string | null;
  websiteUrl?: string | null;
  factoryPreviewUrl?: string | null;
}): string | null {
  const factory = input.factoryPreviewUrl?.trim();
  return factory || null;
}

/** Published website only. Placeholders and funnel Workers stay out. */
export function clientLiveSiteHref(input: {
  liveUrl?: string | null;
}): string | null {
  const live = input.liveUrl?.trim();
  if (!live || isFactoryPlaceholderUrl(live)) return null;
  return live;
}

/** Keep the tab from the click so a later async preview URL is not popup-blocked. */
export function assignPreviewTab(tab: Window | null, url: string) {
  if (tab && !tab.closed) {
    tab.location.replace(url);
    return;
  }
  window.open(url, "_blank", "noreferrer");
}

/** The host of a published site, for a readable address next to the link. */
export function clientSiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
export type ClientStatusTone =
  | "live"
  | "ready"
  | "publishing"
  | "attention"
  | "critical";

export type ClientBoardQuery = {
  query: string;
  status: ClientStatusFilter;
  theme: ClientThemeFilter;
  sort: ClientSortKey;
  direction: ClientSortDirection;
};

export type ClientProgress = {
  complete: number;
  total: number;
  percent: number;
};

export const DEFAULT_CLIENT_BOARD_QUERY: ClientBoardQuery = {
  query: "",
  status: "all",
  theme: "all",
  sort: "attention",
  direction: "asc",
};

export function clientStatusTone(status: OperationalStatus): ClientStatusTone {
  switch (status) {
    case "live":
      return "live";
    case "ready_to_publish":
      return "ready";
    case "publishing":
      return "publishing";
    case "setup_needed":
      return "attention";
    case "issue":
      return "critical";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function clientStatusFilterLabel(filter: ClientStatusFilter): string {
  return filter === "all" ? "All clients" : OPERATIONAL_STATUS_LABELS[filter];
}

export function clientProgress(summary: OperationalSummary): ClientProgress {
  const items = trackedOperationalItems(summary);
  const total = items.length;
  const complete = items.filter(item => item.complete).length;
  return {
    complete,
    total,
    percent: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}

export function matchesClientQuery(
  item: ClientBoardItem,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [item.client.businessName, item.client.shortName].some(value =>
    value.toLowerCase().includes(needle),
  );
}

export type ClientStatusCounts = Record<ClientStatusFilter, number>;

export function countClientsByStatus(
  items: readonly ClientBoardItem[],
): ClientStatusCounts {
  const counts = { all: items.length } as ClientStatusCounts;
  for (const status of CLIENT_STATUS_ORDER) counts[status] = 0;
  for (const item of items) counts[item.operationalSummary.status] += 1;
  return counts;
}

function compareBusinessName(a: ClientBoardItem, b: ClientBoardItem): number {
  return a.client.businessName.localeCompare(b.client.businessName, undefined, {
    sensitivity: "base",
  });
}

export function clientUpdatedAtMs(item: ClientBoardItem): number {
  const value = item.client.updatedAt;
  if (value == null) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function formatClientUpdatedAt(
  value: Date | string | null | undefined,
): string {
  if (value == null) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attentionRank(item: ClientBoardItem): number {
  return CLIENT_STATUS_ORDER.indexOf(
    item.operationalSummary.status as (typeof CLIENT_STATUS_ORDER)[number],
  );
}

function primaryComparator(
  sort: ClientSortKey,
): (a: ClientBoardItem, b: ClientBoardItem) => number {
  switch (sort) {
    case "attention":
      return (a, b) => attentionRank(a) - attentionRank(b);
    case "name":
      return compareBusinessName;
    case "progress":
      return (a, b) =>
        clientProgress(a.operationalSummary).percent -
        clientProgress(b.operationalSummary).percent;
    case "updated":
      return (a, b) => clientUpdatedAtMs(a) - clientUpdatedAtMs(b);
    default: {
      const exhaustive: never = sort;
      return exhaustive;
    }
  }
}

export function sortClients(
  items: readonly ClientBoardItem[],
  sort: ClientSortKey,
  direction: ClientSortDirection,
): ClientBoardItem[] {
  const primary = primaryComparator(sort);
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort(
    (a, b) => factor * primary(a, b) || compareBusinessName(a, b),
  );
}

export function filterClients(
  items: readonly ClientBoardItem[],
  query: string,
  status: ClientStatusFilter,
  theme: ClientThemeFilter = "all",
): ClientBoardItem[] {
  return items.filter(
    item =>
      matchesClientQuery(item, query) &&
      (status === "all" || item.operationalSummary.status === status) &&
      (theme === "all" || item.client.theme === theme),
  );
}

export type ClientBoard = {
  visible: ClientBoardItem[];
  counts: ClientStatusCounts;
  filtered: boolean;
};

export function buildClientBoard(
  items: readonly ClientBoardItem[],
  board: ClientBoardQuery,
): ClientBoard {
  return {
    visible: sortClients(
      filterClients(items, board.query, board.status, board.theme),
      board.sort,
      board.direction,
    ),
    counts: countClientsByStatus(items),
    filtered:
      board.query.trim() !== "" || board.status !== "all" || board.theme !== "all",
  };
}

/** Clicking the active column flips direction. A new column starts ascending, except last-updated which starts newest first. */
export function nextSortDirection(
  current: ClientBoardQuery,
  sort: ClientSortKey,
): ClientSortDirection {
  if (current.sort !== sort) return sort === "updated" ? "desc" : "asc";
  return current.direction === "asc" ? "desc" : "asc";
}

export type ClientNextAction = {
  label: string;
  detail: string;
  destination: ClientDestination;
};

export function nextClientAction(summary: OperationalSummary): ClientNextAction {
  if (summary.status === "issue") {
    return {
      label: "Fix the failed publish",
      detail: "Open Launch to inspect the last job and retry it.",
      destination: "launch",
    };
  }
  if (summary.status === "publishing") {
    return {
      label: "Watch the publish job",
      detail: "A publish is in progress. Launch tracks it until it finishes.",
      destination: "launch",
    };
  }
  const incomplete = trackedOperationalItems(summary).find(item => !item.complete);
  if (!incomplete) {
    return {
      label: "Review the live site",
      detail: "Required setup is complete. Preview the published pages.",
      destination: "pages",
    };
  }
  switch (incomplete.key) {
    case "businessInformation":
      return {
        label: "Finish business details",
        detail: incomplete.label,
        destination: "configuration",
      };
    case "websiteSetup":
      return {
        label: "Finish website setup",
        detail: "Theme, fonts, or required site images still need work.",
        destination: "configuration",
      };
    case "websiteIntegrations":
      return {
        label: "Connect website integrations",
        detail: incomplete.label,
        destination: "integrations",
      };
    case "websiteLive":
      return {
        label: "Publish the website",
        detail: "Configuration is ready. Publish from the Launch tab.",
        destination: "launch",
      };
    case "funnelIntegrations":
      return {
        label: "Connect campaign integrations",
        detail: incomplete.label,
        destination: "integrations",
      };
    case "funnelsLive":
      return {
        label: "Publish a campaign",
        detail: incomplete.label,
        destination: "campaigns",
      };
    default: {
      const exhaustive: never = incomplete.key;
      return exhaustive;
    }
  }
}
