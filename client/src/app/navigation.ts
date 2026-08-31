import { getClientIdFromWorkspacePath } from "@/lib/workspaceNavigation";

/** Top-level destinations, grouped as they appear in the sidebar rail. */
export const PRIMARY_SECTIONS = [
  "clients",
  "templates",
  "activity",
  "systemSettings",
] as const;

export type PrimarySection = (typeof PRIMARY_SECTIONS)[number];

export const SECTION_GROUPS = ["main", "settings"] as const;
export type SectionGroup = (typeof SECTION_GROUPS)[number];

export const SECTION_GROUP_LABELS: Record<SectionGroup, string> = {
  main: "Main",
  settings: "Settings",
};

/**
 * `deferred` sections are designed but inert: they depend on capabilities this
 * phase does not enable (publishing, Cloudflare, customer GitHub) or on stores
 * that do not exist yet, so they state that rather than show invented data.
 */
export type SectionAvailability = "active" | "deferred";

export type PrimarySectionDefinition = {
  section: PrimarySection;
  label: string;
  path: string;
  group: SectionGroup;
  availability: SectionAvailability;
};

export const PRIMARY_SECTION_DEFINITIONS: Record<
  PrimarySection,
  PrimarySectionDefinition
> = {
  clients: {
    section: "clients",
    label: "Clients",
    path: "/clients",
    group: "main",
    availability: "active",
  },
  templates: {
    section: "templates",
    label: "Templates",
    path: "/templates",
    group: "main",
    availability: "deferred",
  },
  activity: {
    section: "activity",
    label: "Activity",
    path: "/activity",
    group: "main",
    availability: "active",
  },
  systemSettings: {
    section: "systemSettings",
    label: "System Settings",
    path: "/system-settings",
    group: "settings",
    availability: "deferred",
  },
};

export const PRIMARY_SECTION_LIST: PrimarySectionDefinition[] =
  PRIMARY_SECTIONS.map(section => PRIMARY_SECTION_DEFINITIONS[section]);

export function sectionsInGroup(group: SectionGroup): PrimarySectionDefinition[] {
  return PRIMARY_SECTION_LIST.filter(item => item.group === group);
}

function normalizePath(location: string): string {
  const [pathname] = location.split("?");
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/**
 * Resolves the sidebar section for a location. Client-scoped routes stay under
 * Clients so the rail keeps a stable highlight while an operator works inside
 * one client.
 */
export function getPrimarySection(location: string): PrimarySection {
  const path = normalizePath(location);
  if (path === "/templates") return "templates";
  if (path === "/activity") return "activity";
  if (path === "/system-settings") return "systemSettings";
  return "clients";
}

/** True when the location addresses a single client, which reveals client chrome. */
export function isClientScopedLocation(location: string): boolean {
  return getClientIdFromWorkspacePath(normalizePath(location)) !== undefined;
}
