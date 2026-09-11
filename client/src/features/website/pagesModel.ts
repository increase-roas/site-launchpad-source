import type { BadgeTone } from "@/components/dashboard/StatusBadge";
import {
  configurationRoute,
  workspaceRoute,
  type ConfigurationTab,
} from "@/lib/workspaceNavigation";
import {
  ASTRO_CATEGORY_VALUES,
  summarizeHomepageSections,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import type {
  ConfigReadiness,
  ConfigSectionId,
} from "@shared/astroConfigReadiness";

/**
 * The customer-facing page groups the Astro template ships. The set is fixed by
 * the template, so nothing here is stored per client: every row is derived from
 * the configuration that publishes, which is why this view cannot drift from the
 * live site the way a separate page table did.
 */
export const SITE_PAGE_IDS = [
  "homepage",
  "categories",
  "inventory",
  "visitUs",
  "financing",
] as const;
export type SitePageId = (typeof SITE_PAGE_IDS)[number];

/**
 * `off` means the template will not render the page for this client at all.
 * `live` requires the website to have been published, so a page never claims to
 * be public before a deploy exists.
 */
export type PageState = "live" | "ready" | "attention" | "off";

export type PageRow = {
  id: SitePageId;
  title: string;
  /** Canonical template route. Groups use the route pattern they expand into. */
  slug: string;
  state: PageState;
  /** What the page still needs, or what it renders when everything is done. */
  detail: string;
  /** The configuration surface that owns this page's content. */
  ownerLabel: string;
  ownerHref: string;
};

export type SiteMapInput = {
  clientId: number;
  config: AstroClientConfigInput;
  readiness: ConfigReadiness;
  /** True once a completed publish exists for this client. */
  published: boolean;
};

/**
 * Whether the template publishes the page, and what to say about it. Keeping
 * `blocked` distinct from `off` is the difference between "this needs work" and
 * "the client deliberately does not have this page".
 */
type PageAvailability =
  | { kind: "off"; detail: string }
  | { kind: "blocked"; detail: string }
  | { kind: "available"; detail: string };

type PageDefinition = {
  id: SitePageId;
  title: string;
  slug: string;
  owner: { tab: ConfigurationTab; section: ConfigSectionId; label: string };
  /** Configuration sections whose readiness decides whether this page is done. */
  sections: readonly ConfigSectionId[];
  describe: (config: AstroClientConfigInput) => PageAvailability;
};

const PAGE_DEFINITIONS: readonly PageDefinition[] = [
  {
    id: "homepage",
    title: "Homepage",
    slug: "/",
    owner: { tab: "content", section: "homepage", label: "Homepage sections" },
    sections: ["homepage"],
    describe: config => {
      const { enabled, total } = summarizeHomepageSections(config.homepageSections);
      return enabled === 0
        ? {
            kind: "blocked",
            detail: "No sections are visible, so the homepage would publish empty.",
          }
        : { kind: "available", detail: `${enabled} of ${total} sections visible` };
    },
  },
  {
    id: "categories",
    title: "Category pages",
    slug: "/{category}",
    owner: { tab: "content", section: "categories", label: "Categories" },
    sections: ["categories"],
    describe: config => {
      const enabled = ASTRO_CATEGORY_VALUES.filter(
        category => config.categories[category].enabled,
      ).length;
      return enabled === 0
        ? {
            kind: "off",
            detail: "No categories are enabled, so no category page publishes.",
          }
        : {
            kind: "available",
            detail: `${enabled} of ${ASTRO_CATEGORY_VALUES.length} categories enabled`,
          };
    },
  },
  {
    id: "inventory",
    title: "Inventory",
    slug: "/inventory",
    owner: { tab: "technical", section: "integrations", label: "Inventory" },
    sections: ["integrations"],
    describe: config =>
      config.integrations.d1.enabled && config.integrations.r2.enabled
        ? {
            kind: "available",
            detail: "Products come from the D1 database and R2 bucket.",
          }
        : {
            kind: "blocked",
            detail: "Turn on the D1 database and R2 bucket so products can load.",
          },
  },
  {
    id: "visitUs",
    title: "Visit us",
    slug: "/visit-us",
    owner: { tab: "basic", section: "address", label: "Business details" },
    sections: ["address", "hours", "contact"],
    describe: () => ({
      kind: "available",
      detail: "Address, hours, and contact details are complete.",
    }),
  },
  {
    id: "financing",
    title: "Financing",
    slug: "/financing",
    owner: { tab: "content", section: "financing", label: "Financing" },
    sections: ["financing"],
    describe: config =>
      config.financing.enabled
        ? { kind: "available", detail: "Lender details and disclosures are complete." }
        : {
            kind: "off",
            detail: "Financing is off, so this page does not publish.",
          },
  },
];

function outstandingFields(
  readiness: ConfigReadiness,
  sections: readonly ConfigSectionId[],
): number {
  return sections.reduce(
    (total, id) =>
      total + readiness.sections[id].incomplete + readiness.sections[id].invalid,
    0,
  );
}

function resolveState(
  availability: PageAvailability,
  outstanding: number,
  published: boolean,
): { state: PageState; detail: string } {
  switch (availability.kind) {
    case "off":
      return { state: "off", detail: availability.detail };
    case "blocked":
      return { state: "attention", detail: availability.detail };
    case "available":
      if (outstanding > 0) {
        return {
          state: "attention",
          detail: `${outstanding} ${outstanding === 1 ? "field needs" : "fields need"} attention`,
        };
      }
      return {
        state: published ? "live" : "ready",
        detail: availability.detail,
      };
    default: {
      const exhaustive: never = availability;
      throw new Error(`Unhandled page availability: ${String(exhaustive)}`);
    }
  }
}

export function buildSiteMap(input: SiteMapInput): PageRow[] {
  return PAGE_DEFINITIONS.map(definition => {
    const { state, detail } = resolveState(
      definition.describe(input.config),
      outstandingFields(input.readiness, definition.sections),
      input.published,
    );
    return {
      id: definition.id,
      title: definition.title,
      slug: definition.slug,
      state,
      detail,
      ownerLabel: definition.owner.label,
      ownerHref:
        definition.id === "inventory"
          ? workspaceRoute("inventory", input.clientId)
          : configurationRoute(
              input.clientId,
              definition.owner.tab,
              definition.owner.section,
            ),
    };
  });
}

export function pageStateLabel(state: PageState): string {
  switch (state) {
    case "live":
      return "Live";
    case "ready":
      return "Ready";
    case "attention":
      return "Needs attention";
    case "off":
      return "Off";
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled page state: ${String(exhaustive)}`);
    }
  }
}

export function pageStateTone(state: PageState): BadgeTone {
  switch (state) {
    case "live":
      return "success";
    case "ready":
      return "primary";
    case "attention":
      return "warning";
    case "off":
      return "neutral";
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled page state: ${String(exhaustive)}`);
    }
  }
}

export type SiteMapMetrics = {
  total: number;
  live: number;
  ready: number;
  attention: number;
  off: number;
  /** Pages the template will actually render for this client. */
  publishable: number;
  /** Share of publishable pages that need no further work. */
  readyPercent: number;
};

export function buildSiteMapMetrics(pages: readonly PageRow[]): SiteMapMetrics {
  let live = 0;
  let ready = 0;
  let attention = 0;
  let off = 0;

  for (const page of pages) {
    switch (page.state) {
      case "live":
        live += 1;
        break;
      case "ready":
        ready += 1;
        break;
      case "attention":
        attention += 1;
        break;
      case "off":
        off += 1;
        break;
      default: {
        const exhaustive: never = page.state;
        throw new Error(`Unhandled page state: ${String(exhaustive)}`);
      }
    }
  }

  const publishable = pages.length - off;
  return {
    total: pages.length,
    live,
    ready,
    attention,
    off,
    publishable,
    readyPercent:
      publishable === 0 ? 0 : Math.round(((live + ready) / publishable) * 100),
  };
}
