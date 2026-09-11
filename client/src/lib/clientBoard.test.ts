import { describe, expect, it, vi } from "vitest";
import type { ThemeValue } from "@shared/client";
import type { OperationalStatus } from "@shared/operationalSummary";
import {
  buildClientBoard,
  clientProgress,
  clientStatusTone,
  countClientsByStatus,
  DEFAULT_CLIENT_BOARD_QUERY,
  filterClients,
  assignPreviewTab,
  clientAdminHref,
  clientLiveSiteHref,
  clientPreviewHref,
  clientSiteHost,
  clientThemeLabel,
  formatClientUpdatedAt,
  matchesClientQuery,
  nextClientAction,
  nextSortDirection,
  sortClients,
  trackedOperationalItems,
  type ClientBoardItem,
} from "./clientBoard";

function client(
  id: number,
  businessName: string,
  shortName: string,
  status: OperationalStatus,
  completeCount = 0,
  updatedAt?: Date,
  theme?: ThemeValue,
): ClientBoardItem {
  const keys = [
    "businessInformation",
    "websiteSetup",
    "websiteIntegrations",
    "websiteLive",
    "funnelIntegrations",
    "funnelsLive",
  ] as const;
  return {
    client: { id, businessName, shortName, theme, updatedAt },
    operationalSummary: {
      items: keys.map((key, index) => ({
        key,
        label: key,
        complete: index < completeCount,
      })),
      status,
      statusLabel: status,
      liveUrl: null,
      runtimeConfiguration: {
        set: 0,
        total: 0,
        label: "",
        requiredMissing: [],
        optionalUnset: [],
        blocksLaunch: false,
      },
    },
  };
}

const northgate = client(1, "Northgate Spas", "northgate", "setup_needed", 2);
const paradise = client(2, "Paradise Pools", "paradise", "live", 6);
const atlantic = client(3, "Atlantic Hot Tubs", "atlantic", "issue", 4);
const beacon = client(4, "Beacon Leisure", "beacon", "ready_to_publish", 5);
const everyClient = [northgate, paradise, atlantic, beacon];

describe("client board", () => {
  it("reports completion progress out of the tracked summary items", () => {
    expect(clientProgress(northgate.operationalSummary)).toEqual({
      complete: 2,
      total: 4,
      percent: 50,
    });
    expect(clientProgress(paradise.operationalSummary).percent).toBe(100);
  });

  it("leaves campaign readiness out of progress while campaigns are deferred", () => {
    const tracked = trackedOperationalItems(northgate.operationalSummary).map(
      item => item.key,
    );

    expect(tracked).not.toContain("funnelIntegrations");
    expect(tracked).not.toContain("funnelsLive");
    expect(tracked).toContain("websiteLive");
  });

  it("never sends an operator to campaigns for work they cannot do yet", () => {
    // Everything but the two campaign items is complete, which used to read as
    // "Publish a campaign" and drop the operator on a deferred screen.
    const websiteDone = client(13, "Website Done", "done", "setup_needed", 4);

    expect(nextClientAction(websiteDone.operationalSummary)).toMatchObject({
      destination: "pages",
      label: "Review the live site",
    });
  });

  it("matches the search query against business and short name, ignoring case", () => {
    expect(matchesClientQuery(northgate, "north")).toBe(true);
    expect(matchesClientQuery(northgate, "NORTHGATE")).toBe(true);
    expect(matchesClientQuery(northgate, "  northgate  ")).toBe(true);
    expect(matchesClientQuery(northgate, "paradise")).toBe(false);
  });

  it("treats an empty query as no filter", () => {
    expect(matchesClientQuery(northgate, "")).toBe(true);
    expect(matchesClientQuery(northgate, "   ")).toBe(true);
  });

  it("counts every status so filter chips stay stable at zero", () => {
    expect(countClientsByStatus(everyClient)).toEqual({
      all: 4,
      issue: 1,
      setup_needed: 1,
      publishing: 0,
      ready_to_publish: 1,
      live: 1,
    });
  });

  it("filters by status and query together", () => {
    expect(filterClients(everyClient, "", "live")).toEqual([paradise]);
    expect(filterClients(everyClient, "a", "issue")).toEqual([atlantic]);
    expect(filterClients(everyClient, "paradise", "issue")).toEqual([]);
  });

  it("filters by theme alongside status and query", () => {
    const aqua = client(5, "Aqua Works", "aqua-works", "live", 6, undefined, "aqua");
    const luxury = client(
      6,
      "Luxury Living",
      "luxury-living",
      "live",
      6,
      undefined,
      "luxury",
    );
    const themed = [aqua, luxury, northgate];
    expect(filterClients(themed, "", "all", "aqua")).toEqual([aqua]);
    expect(filterClients(themed, "", "all", "all")).toEqual(themed);
    expect(filterClients(themed, "", "live", "luxury")).toEqual([luxury]);
    expect(filterClients(themed, "", "all", "mono")).toEqual([]);
  });

  it("flags the board as filtered when only a theme is selected", () => {
    expect(
      buildClientBoard(everyClient, {
        ...DEFAULT_CLIENT_BOARD_QUERY,
        theme: "aqua",
      }),
    ).toMatchObject({ visible: [], filtered: true });
  });

  it("sorts the most urgent clients first by default", () => {
    const sorted = sortClients(everyClient, "attention", "asc");
    expect(sorted.map(item => item.operationalSummary.status)).toEqual([
      "issue",
      "setup_needed",
      "ready_to_publish",
      "live",
    ]);
  });

  it("reverses the primary comparator when sorting descending", () => {
    const names = sortClients(everyClient, "name", "desc").map(
      item => item.client.businessName,
    );
    expect(names).toEqual([
      "Paradise Pools",
      "Northgate Spas",
      "Beacon Leisure",
      "Atlantic Hot Tubs",
    ]);
  });

  it("breaks sort ties on business name", () => {
    const first = client(9, "Zulu Spas", "zulu", "live", 6);
    const second = client(10, "Alpha Spas", "alpha", "live", 6);
    expect(
      sortClients([first, second], "progress", "asc").map(
        item => item.client.businessName,
      ),
    ).toEqual(["Alpha Spas", "Zulu Spas"]);
  });

  it("builds the board without mutating the source list", () => {
    const source = [...everyClient];
    const board = buildClientBoard(source, DEFAULT_CLIENT_BOARD_QUERY);
    expect(source).toEqual(everyClient);
    expect(board.visible).toHaveLength(4);
    expect(board.counts.all).toBe(4);
    expect(board.filtered).toBe(false);
  });

  it("flags a filtered board so the empty state can offer a reset", () => {
    expect(
      buildClientBoard(everyClient, {
        ...DEFAULT_CLIENT_BOARD_QUERY,
        query: "nothing matches",
      }),
    ).toMatchObject({ visible: [], filtered: true });
    expect(
      buildClientBoard(everyClient, {
        ...DEFAULT_CLIENT_BOARD_QUERY,
        status: "publishing",
      }),
    ).toMatchObject({ visible: [], filtered: true });
  });

  it("starts a new sort column ascending and flips the active one", () => {
    const board = { ...DEFAULT_CLIENT_BOARD_QUERY, sort: "name" } as const;
    expect(nextSortDirection(board, "progress")).toBe("asc");
    expect(nextSortDirection(board, "updated")).toBe("desc");
    expect(nextSortDirection(board, "name")).toBe("desc");
    expect(nextSortDirection({ ...board, direction: "desc" }, "name")).toBe(
      "asc",
    );
  });

  it("sorts last-updated newest first and formats missing timestamps as a dash", () => {
    const older = client(
      11,
      "Older Co",
      "older",
      "live",
      6,
      new Date("2026-01-01T00:00:00Z"),
    );
    const newer = client(
      12,
      "Newer Co",
      "newer",
      "live",
      6,
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(
      sortClients([older, newer], "updated", "desc").map(item => item.client.id),
    ).toEqual([12, 11]);
    expect(formatClientUpdatedAt(undefined)).toBe("—");
    expect(formatClientUpdatedAt("not-a-date")).toBe("—");
  });

  it("names a known theme and stays quiet about an unknown one", () => {
    expect(clientThemeLabel("aqua")).toBe("Aqua");
    expect(clientThemeLabel("luxury")).toBe("Luxury");
    expect(clientThemeLabel("retro")).toBeNull();
    expect(clientThemeLabel(null)).toBeNull();
    expect(clientThemeLabel(undefined)).toBeNull();
  });

  it("does not treat a published funnel or example.com as website preview", () => {
    expect(
      clientPreviewHref({
        liveUrl: "https://funnel-theme-matrix-qa-1.increase-roas.workers.dev/",
        websiteUrl: "https://example.com",
      }),
    ).toBeNull();
    expect(
      clientPreviewHref({
        liveUrl: "https://the-hot-tub.workers.dev",
        websiteUrl: "https://thehottub.com",
        factoryPreviewUrl: "http://localhost:4321/",
      }),
    ).toBe("http://localhost:4321/");
    expect(
      clientLiveSiteHref({
        liveUrl: "https://the-hot-tub.increase-roas.workers.dev/",
      }),
    ).toBe("https://the-hot-tub.increase-roas.workers.dev/");
    expect(clientLiveSiteHref({ liveUrl: "https://example.com" })).toBeNull();
  });

  it("navigates a tab opened from the preview click", () => {
    const replace = vi.fn();
    assignPreviewTab(
      { closed: false, location: { replace } } as unknown as Window,
      "http://localhost:4321/",
    );
    expect(replace).toHaveBeenCalledWith("http://localhost:4321/");
  });

  it("builds the live-site inventory admin URL from a published or preview origin", () => {
    expect(clientAdminHref("https://harborandheatspas.com/visit-us")).toBe(
      "https://harborandheatspas.com/admin",
    );
    expect(
      clientAdminHref("https://website-15.increase-roas.workers.dev/"),
    ).toBe("https://website-15.increase-roas.workers.dev/admin");
    expect(clientAdminHref("https://example.com")).toBeNull();
    expect(clientAdminHref("not-a-url")).toBeNull();
    expect(clientAdminHref(null)).toBeNull();
  });

  it("reads the host of a published site and tolerates a broken address", () => {
    expect(clientSiteHost("https://spa-co.increase-roas.workers.dev/pricing")).toBe(
      "spa-co.increase-roas.workers.dev",
    );
    expect(clientSiteHost("not-a-url")).toBeNull();
    expect(clientSiteHost(null)).toBeNull();
  });

  it("maps every operational status to a distinct tone", () => {
    expect(clientStatusTone("live")).toBe("live");
    expect(clientStatusTone("ready_to_publish")).toBe("ready");
    expect(clientStatusTone("publishing")).toBe("publishing");
    expect(clientStatusTone("setup_needed")).toBe("attention");
    expect(clientStatusTone("issue")).toBe("critical");
  });

  it("points the operator at the first incomplete launch step", () => {
    expect(nextClientAction(northgate.operationalSummary)).toMatchObject({
      destination: "integrations",
      label: "Connect website integrations",
    });
    expect(nextClientAction(paradise.operationalSummary).destination).toBe("pages");
  });

  it("sends publish trouble to Launch, which owns the publish job", () => {
    expect(nextClientAction(atlantic.operationalSummary)).toMatchObject({
      destination: "launch",
      label: "Fix the failed publish",
    });
    expect(
      nextClientAction(client(9, "Publishing", "pub", "publishing", 4).operationalSummary)
        .destination,
    ).toBe("launch");
  });
});
