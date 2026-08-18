import { describe, expect, it } from "vitest";
import {
  buildClientIntegrationProfileDto,
  emptyIdentifiers,
  emptySecretPresence,
} from "../clientIntegrationProfile";
import {
  emptyClientIntegrationPresence,
  integrationPresenceHasSecretValue,
  integrationPresenceRows,
} from "./integrationPresence";

describe("paid funnel integration presence is SET/NOT SET only", () => {
  it("renders ClientIntegrationProfile groups without secret values", () => {
    const presence = emptySecretPresence();
    presence.GHL_API_KEY = "SET";
    presence.META_CAPI_ACCESS_TOKEN = "NOT SET";
    const dto = buildClientIntegrationProfileDto({
      clientId: 4,
      identifiers: { ...emptyIdentifiers(), GHL_LOCATION_ID: "loc_hidden_from_funnel_ui" },
      secretPresence: presence,
      lastUpdated: new Date("2026-08-18T00:00:00.000Z"),
      reconciliationStatus: "ready",
      conflictedKeys: [],
    });
    const rows = integrationPresenceRows(dto);
    expect(rows.map(group => group.id)).toEqual(["ghl", "sheets", "meta", "callbacks", "other"]);
    const ghl = rows.find(group => group.id === "ghl");
    expect(ghl?.fields.find(field => field.key === "GHL_API_KEY")?.presence).toBe("SET");
    expect(ghl?.fields.find(field => field.key === "GHL_LOCATION_ID")?.presence).toBe("SET");
    expect(JSON.stringify(rows)).not.toContain("loc_hidden_from_funnel_ui");
    expect(integrationPresenceHasSecretValue(dto, ["ghl-live-secret"])).toBe(false);
  });

  it("defaults a client profile to NOT SET until Clients -> Integrations is filled", () => {
    const dto = emptyClientIntegrationPresence(4);
    expect(dto.clientId).toBe(4);
    expect(dto.readiness.funnelReady).toBe(false);
    const keys = integrationPresenceRows(dto).flatMap(group => group.fields);
    expect(keys.every(field => field.presence === "NOT SET")).toBe(true);
  });
});
