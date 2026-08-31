import { describe, expect, it } from "vitest";
import {
  campaignBlockerGroups,
  campaignBlockers,
  campaignSectionOwner,
  campaignStepStatuses,
  type CampaignReadiness,
} from "./campaignSteps";

function readiness(notReady: readonly string[]): CampaignReadiness {
  const keys = [
    "client",
    "offer",
    "serviceArea",
    "meta",
    "ghl",
    "googleSheets",
    "inventory",
    "offlineConversion",
    "productionSecrets",
  ];
  const sections = keys.map(key => ({
    key,
    label: key,
    ready: !notReady.includes(key),
    missing: notReady.includes(key) ? [`${key} field`] : [],
  }));
  return { sections, configurationReady: sections.every(section => section.ready) };
}

describe("campaign readiness ownership", () => {
  it("files each server section under whoever can clear it", () => {
    expect(campaignSectionOwner("client")).toBe("setup");
    expect(campaignSectionOwner("offer")).toBe("setup");
    expect(campaignSectionOwner("serviceArea")).toBe("setup");
    expect(campaignSectionOwner("inventory")).toBe("content");
    expect(campaignSectionOwner("meta")).toBe("client-setup");
    expect(campaignSectionOwner("ghl")).toBe("client-setup");
    expect(campaignSectionOwner("productionSecrets")).toBe("client-setup");
  });

  it("treats a section the server adds later as client setup rather than dropping it", () => {
    expect(campaignSectionOwner("somethingNew")).toBe("client-setup");
  });

  it("counts against a step only what that step can fix", () => {
    const statuses = campaignStepStatuses(
      readiness(["offer", "client", "inventory", "ghl", "productionSecrets"]),
    );

    expect(statuses.setup).toEqual({ missingCount: 2, ready: false });
    expect(statuses.content).toEqual({ missingCount: 1, ready: false });
  });

  it("keeps a step ready while only the client profile is outstanding", () => {
    const statuses = campaignStepStatuses(readiness(["ghl", "googleSheets"]));

    expect(statuses.setup.ready).toBe(true);
    expect(statuses.content.ready).toBe(true);
  });

  it("holds every step pending until readiness loads", () => {
    const statuses = campaignStepStatuses(undefined);

    for (const status of Object.values(statuses)) {
      expect(status).toEqual({ missingCount: null, ready: false });
    }
  });

  it("lists only the sections that still block publishing", () => {
    expect(campaignBlockers(readiness(["offer", "ghl"])).map(section => section.key)).toEqual([
      "offer",
      "ghl",
    ]);
    expect(campaignBlockers(readiness([]))).toEqual([]);
    expect(campaignBlockers(undefined)).toEqual([]);
  });

  it("splits blockers into campaign work and client profile work", () => {
    const groups = campaignBlockerGroups(readiness(["offer", "inventory", "meta"]));

    expect(groups.campaign.map(blocker => [blocker.section.key, blocker.step])).toEqual([
      ["offer", "setup"],
      ["inventory", "content"],
    ]);
    expect(groups.clientSetup.map(section => section.key)).toEqual(["meta"]);
  });

  it("reports no blocker groups once readiness is complete", () => {
    expect(campaignBlockerGroups(readiness([]))).toEqual({
      campaign: [],
      clientSetup: [],
    });
    expect(campaignBlockerGroups(undefined)).toEqual({
      campaign: [],
      clientSetup: [],
    });
  });
});
