import {
  buildClientIntegrationProfileDto,
  emptyIdentifiers,
  emptySecretPresence,
} from "@shared/clientIntegrationProfile";
import { describe, expect, it } from "vitest";
import { effectiveReadiness, type IntegrationDraftState } from "./integrationStatus";

const noEdits: IntegrationDraftState = {
  identifiers: { GHL_LOCATION_ID: "", GOOGLE_SHEETS_ID: "", META_PIXEL_ID: "" },
  secrets: {},
  clearedSecrets: [],
  rotateStageWebhookSecret: false,
};

function profileWithAdminSecretsOnly() {
  const secretPresence = emptySecretPresence();
  secretPresence.ADMIN_PASSWORD = "SET";
  secretPresence.ADMIN_SESSION_SECRET = "SET";
  return buildClientIntegrationProfileDto({
    clientId: 7,
    identifiers: emptyIdentifiers(),
    secretPresence,
    lastUpdated: null,
    reconciliationStatus: "ready",
    conflictedKeys: [],
  });
}

describe("integrations page readiness", () => {
  it("does not list a switched-off integration's credentials against the website", () => {
    const readiness = effectiveReadiness(profileWithAdminSecretsOnly(), noEdits, {});
    expect(readiness.missingWebsiteKeys).toEqual([]);
    expect(readiness.websiteReady).toBe(true);
  });

  it("lists the credentials of an integration that is switched on", () => {
    const readiness = effectiveReadiness(profileWithAdminSecretsOnly(), noEdits, {
      ghl: true,
    });
    expect(readiness.missingWebsiteKeys).toEqual(["GHL_API_KEY", "GHL_LOCATION_ID"]);
  });

  it("keeps reporting the funnel surface from the full funnel contract", () => {
    const readiness = effectiveReadiness(profileWithAdminSecretsOnly(), noEdits, {});
    expect(readiness.funnelReady).toBe(false);
    expect(readiness.missingFunnelKeys).toContain("GOOGLE_SHEETS_ID");
  });
});
