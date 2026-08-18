import { readFileSync } from "node:fs";
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

  it("keeps the lifecycle callback secret presence-only", () => {
    const crmGuide = SIMPLE_FORM_SECRET_GUIDES.find(
      guide => guide.runtimeKey === "STAGE_WEBHOOK_SECRET",
    );
    expect(crmGuide?.whereToFind).toContain("generates");
    expect(crmGuide?.whereToFind).not.toContain("Reveal secret");

    const simpleFormEditor = readFileSync(
      "client/src/components/funnels/SimpleFormFunnelEditor.tsx",
      "utf8",
    );
    const clientIntegrationEditor = readFileSync(
      "client/src/pages/ClientIntegrationsPage.tsx",
      "utf8",
    );
    expect(clientIntegrationEditor).toContain("Generate / rotate");
    expect(clientIntegrationEditor).toContain("Stored values are never returned");
    expect(simpleFormEditor).not.toContain("Reveal secret");
    expect(simpleFormEditor).not.toContain("GHL_API_KEY");
    expect(simpleFormEditor).not.toContain("GHL_WEBHOOK_URL");
  });
});
