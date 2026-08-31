import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMPAIGNS_DEFERRED } from "@/lib/deferredFeatures";
import {
  CLIENT_TAB_DEFINITIONS,
  CLIENT_TAB_LIST,
  clientTabHref,
} from "./clientTabs";

describe("client tabs", () => {
  it("marks campaigns deferred while the capability is switched off", () => {
    expect(CAMPAIGNS_DEFERRED).toBe(true);
    expect(CLIENT_TAB_DEFINITIONS.campaigns.availability).toBe("deferred");
  });

  it("keeps the deferred tab listed and reachable so it can say it is coming", () => {
    expect(CLIENT_TAB_LIST.map(tab => tab.tab)).toContain("campaigns");
    expect(clientTabHref("campaigns", 7)).toBe("/workspace/7/campaigns");
  });

  it("routes the campaigns path at the notice, not the editor", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");

    expect(app).toContain("DeferredCampaignsPage");
    expect(app).not.toContain("features/campaigns/CampaignsPage");
  });
});
