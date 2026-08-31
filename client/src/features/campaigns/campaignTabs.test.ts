import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TABS,
  CAMPAIGN_TAB_LABELS,
  campaignSearch,
  parseCampaignSearch,
  parseCampaignTab,
} from "./campaignTabs";

describe("campaign steps", () => {
  it("names the three steps of configuring a campaign", () => {
    expect(CAMPAIGN_TABS.map(tab => CAMPAIGN_TAB_LABELS[tab])).toEqual([
      "Setup",
      "Content",
      "Publish",
    ]);
  });

  it("falls back to the first step for missing or unknown steps", () => {
    expect(parseCampaignTab(null)).toBe("setup");
    expect(parseCampaignTab("steps")).toBe("setup");
    expect(parseCampaignTab("content")).toBe("content");
  });

  it("sends links to retired tabs to the step that absorbed their fields", () => {
    expect(parseCampaignTab("overview")).toBe("setup");
    expect(parseCampaignTab("lead-form")).toBe("setup");
    expect(parseCampaignTab("tracking")).toBe("publish");
    expect(parseCampaignSearch("?campaign=7&tab=lead-form")).toEqual({
      campaignId: 7,
      tab: "setup",
    });
  });

  it("opens the campaign named in the URL", () => {
    expect(parseCampaignSearch("?campaign=12&tab=publish")).toEqual({
      campaignId: 12,
      tab: "publish",
    });
    expect(parseCampaignSearch("")).toEqual({ campaignId: null, tab: "setup" });
    expect(parseCampaignSearch("?campaign=abc")).toEqual({
      campaignId: null,
      tab: "setup",
    });
  });

  it("still opens links that use the old funnel parameter", () => {
    expect(parseCampaignSearch("?funnel=7")).toEqual({ campaignId: 7, tab: "setup" });
  });

  it("keeps the first step's URL free of a redundant tab", () => {
    expect(campaignSearch(3, "setup")).toBe("?campaign=3");
    expect(campaignSearch(3, "publish")).toBe("?campaign=3&tab=publish");
  });
});
