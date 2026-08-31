import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  SIMPLE_FORM_SECRET_GUIDES,
  simpleFormOfflineConversionContractSchema,
  simpleFormManifestSchema,
} from "./simpleFormContract";

const expectedOfflineConversionContract = {
  version: 1,
  joinKey: "leadUuid",
  callback: {
    method: "POST",
    route: "/api/lead-stage",
    authentication: "Bearer STAGE_WEBHOOK_SECRET",
  },
  stageMappings: [
    {
      pipelineStage: "Hot Pursuit",
      callbackStage: "qualified",
      metaEvent: "QualifiedLead",
    },
    {
      pipelineStage: "Appointment Set",
      callbackStage: "appointment",
      metaEvent: "Schedule",
    },
    {
      pipelineStage: "Showed",
      callbackStage: "show",
      metaEvent: "Showed",
    },
    {
      pipelineStage: "Sold",
      callbackStage: "sale",
      metaEvent: "Purchase",
    },
  ],
  requiredRuntimeSecrets: [
    "GHL_API_KEY",
    "GHL_LOCATION_ID",
    "GOOGLE_SHEETS_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "META_PIXEL_ID",
    "META_CAPI_ACCESS_TOKEN",
    "STAGE_WEBHOOK_SECRET",
  ],
  deduplication: {
    idempotencyKey: "downstream_conversions.external_id",
    eventId: "downstream_conversions.event_id",
  },
  originalAttribution: {
    reuse: true,
    fields: [
      "first_url",
      "original_query_string",
      "fbc",
      "fbp",
      "ip_address",
      "user_agent",
    ],
  },
  purchase: { requiresExplicitPositiveValue: true },
};

describe("Simple Form template contract", () => {
  it("parses runtime metadata from the vendored launchpad.template.json", () => {
    const raw = JSON.parse(
      readFileSync("server/templates/simple-form/launchpad.template.json", "utf8"),
    );
    expect(simpleFormManifestSchema.parse(raw)).toEqual(SIMPLE_FORM_MANIFEST);
    expect(readFileSync("shared/simpleFormContract.ts", "utf8")).toContain(
      "server/templates/simple-form/launchpad.template.json",
    );
  });

  it("rejects malformed runtime manifest metadata", () => {
    expect(() =>
      simpleFormManifestSchema.parse({
        ...SIMPLE_FORM_MANIFEST,
        shape: "B",
      }),
    ).toThrow();
  });

  it("models the exact canonical offline conversion contract", () => {
    const raw = JSON.parse(
      readFileSync("server/templates/simple-form/launchpad.template.json", "utf8"),
    );

    expect(raw.offlineConversionContract).toEqual(
      expectedOfflineConversionContract,
    );
    expect(SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT).toEqual(
      expectedOfflineConversionContract,
    );
    expect(
      simpleFormOfflineConversionContractSchema.parse(
        raw.offlineConversionContract,
      ),
    ).toEqual(expectedOfflineConversionContract);
  });

  it("rejects missing, renamed, reordered, or extended offline mappings", () => {
    const missingMapping = structuredClone(expectedOfflineConversionContract);
    missingMapping.stageMappings.pop();
    expect(() =>
      simpleFormOfflineConversionContractSchema.parse(missingMapping),
    ).toThrow();

    const renamedMapping = structuredClone(expectedOfflineConversionContract);
    renamedMapping.stageMappings[0].pipelineStage = "Hot Lead";
    expect(() =>
      simpleFormOfflineConversionContractSchema.parse(renamedMapping),
    ).toThrow();

    const reorderedMappings = structuredClone(expectedOfflineConversionContract);
    reorderedMappings.stageMappings.reverse();
    expect(() =>
      simpleFormOfflineConversionContractSchema.parse(reorderedMappings),
    ).toThrow();

    expect(() =>
      simpleFormOfflineConversionContractSchema.parse({
        ...expectedOfflineConversionContract,
        unexpected: true,
      }),
    ).toThrow();
  });

  it("reveals a stored secret only through the audited endpoint", () => {
    const crmGuide = SIMPLE_FORM_SECRET_GUIDES.find(
      guide => guide.runtimeKey === "STAGE_WEBHOOK_SECRET",
    );
    expect(crmGuide?.whereToFind).toContain("generates");

    // Scan the whole integrations feature, not one file, so splitting it up
    // cannot quietly drop rotation or start sourcing plaintext from the profile
    // payload instead of the one endpoint that records who read what.
    const integrationsDir = "client/src/features/integrations";
    const integrationSources = readdirSync(integrationsDir, {
      recursive: true,
      encoding: "utf8",
    })
      .filter(entry => entry.endsWith(".ts") || entry.endsWith(".tsx"))
      .map(entry => readFileSync(path.join(integrationsDir, entry), "utf8"));
    expect(integrationSources.length).toBeGreaterThan(0);
    const integrationsFeature = integrationSources.join("\n");
    expect(integrationsFeature).toContain("rotateStageWebhookSecret");
    expect(integrationsFeature).toContain("Generate one for me");
    expect(integrationsFeature).toContain("revealIntegrationSecret");
    expect(integrationsFeature).toContain("Replaces the stored value when you save.");

    // The profile query stays presence-plus-tail, so the editor has no stored
    // value to read without going through the reveal mutation.
    const serverIntegrations = readFileSync("server/clientIntegrations.ts", "utf8");
    expect(serverIntegrations).toContain("[SecretReveal]");
    const clientsRouterSource = readFileSync("server/routers/clients.ts", "utf8");
    expect(clientsRouterSource).toContain("revealIntegrationSecret: adminProcedure");
    expect(clientsRouterSource).toContain("getIntegrationProfile: protectedProcedure");

    // A campaign never reads or writes an inherited secret. It reports what
    // readiness says is missing and sends the operator to the one editor that
    // owns those values, so there is nothing here to read a stored value with.
    const campaignDir = "client/src/features/campaigns";
    const campaignSources = readdirSync(campaignDir, { recursive: true, encoding: "utf8" })
      .filter(entry => entry.endsWith(".ts") || entry.endsWith(".tsx"))
      .map(entry => readFileSync(path.join(campaignDir, entry), "utf8"));
    expect(campaignSources.length).toBeGreaterThan(0);
    for (const campaignSource of campaignSources) {
      expect(campaignSource).not.toContain("Reveal secret");
      expect(campaignSource).not.toContain("revealIntegrationSecret");
      expect(campaignSource).not.toContain("saveIntegrationProfile");
      expect(campaignSource).not.toContain("GHL_WEBHOOK_URL");
    }
    const publishTab = readFileSync(
      "client/src/features/campaigns/tabs/CampaignPublishTab.tsx",
      "utf8",
    );
    expect(publishTab).toContain('workspaceRoute("integrations"');
  });
});
