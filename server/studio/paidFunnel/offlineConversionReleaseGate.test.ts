import { describe, expect, it } from "vitest";
import { compilePaidFunnelToAstro } from "../../../shared/paidFunnel/astroCompiler";
import { createGenericPaidFunnelFixture } from "../../../shared/paidFunnel/fixture";
import {
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
} from "../../../shared/simpleFormContract";
import { buildGenericPaidFunnelPackageFixture } from "../../../shared/studio/paidFunnelPackage";
import {
  buildReadyPaidFunnelProfileDto,
  buildReadyPaidFunnelSecrets,
} from "./profileMapping";

function generatedFiles() {
  return compilePaidFunnelToAstro(
    createGenericPaidFunnelFixture("offline-gate")
  );
}

describe("offline conversion contract v1 release gate", () => {
  it("keeps Simple Form and generic Astro funnels on the exact same canonical contract", () => {
    const generic = buildGenericPaidFunnelPackageFixture();
    expect(SIMPLE_FORM_MANIFEST.offlineConversionContract).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT
    );
    expect(generic.offlineConversionContract).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT
    );
    expect(generic.requiredRuntimeSecrets).toEqual(
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets
    );
    expect(SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.stageMappings).toEqual([
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
      { pipelineStage: "Showed", callbackStage: "show", metaEvent: "Showed" },
      { pipelineStage: "Sold", callbackStage: "sale", metaEvent: "Purchase" },
    ]);
  });

  it("uses one browser event ID for Pixel and server CAPI and retains original attribution", () => {
    const files = generatedFiles();
    const runtime =
      files.find(file => file.path === "public/scripts/funnel-runtime.js")
        ?.contents ?? "";
    const endpoint =
      files.find(file => file.path === "src/pages/api/funnel-event.ts")
        ?.contents ?? "";
    const migration =
      files.find(file => file.path === "migrations/0001_funnel_events.sql")
        ?.contents ?? "";

    expect(runtime).toContain("const event_id = id()");
    expect(runtime).toContain("eventID: event_id");
    expect(runtime).toContain("event_id, event_name");
    expect(runtime).toContain(
      'const ATTRIBUTION_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid"]'
    );
    expect(runtime).toContain("lead_uuid");
    expect(runtime).toContain("first_url");
    expect(runtime).toContain("original_query_string");
    expect(runtime).toContain("fbp");
    expect(runtime).toContain("fbc");
    expect(endpoint).toContain("event_id: text(payload.event_id)");
    expect(endpoint).toContain("client_ip_address");
    expect(endpoint).toContain("client_user_agent");
    for (const field of SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT
      .originalAttribution.fields) {
      expect(migration).toContain(field);
    }
  });

  it("upserts GHL, assigns idempotent Sheet rows, and uses only the service-account pair", () => {
    const endpoint =
      generatedFiles().find(
        file => file.path === "src/pages/api/funnel-event.ts"
      )?.contents ?? "";
    expect(endpoint).toContain(
      "https://services.leadconnectorhq.com/contacts/upsert"
    );
    expect(endpoint).toContain("createNewIfDuplicateAllowed: false");
    expect(endpoint).toContain("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    expect(endpoint).toContain("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    expect(endpoint).toContain(
      "rows.some(row => text(row[1]) === text(payload.event_id))"
    );
    expect(endpoint).toContain(
      "SELECT sheet_row, status FROM sheet_delivery_rows"
    );
    expect(endpoint).toContain("RETURNING next_row - 1 AS sheet_row");
    expect(endpoint).toContain('method: "PUT"');
    expect(endpoint).not.toContain(":append?valueInputOption");
    expect(endpoint).toContain("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(endpoint).not.toContain("accounts.google.com/o/oauth2/auth");
    expect(endpoint).not.toContain("refresh_token");
    expect(endpoint).not.toContain("client_secret");
  });

  it("authenticates stage callbacks and emits the canonical deduplicated events", () => {
    const endpoint =
      generatedFiles().find(file => file.path === "src/pages/api/lead-stage.ts")
        ?.contents ?? "";
    expect(endpoint).toContain(
      'request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "")'
    );
    expect(endpoint).toContain("STAGE_WEBHOOK_SECRET");
    expect(endpoint).toContain(
      '{ qualified: "QualifiedLead", appointment: "Schedule", show: "Showed", sale: "Purchase" }'
    );
    expect(endpoint).toContain('const externalId = leadUuid + ":" + stage');
    expect(endpoint).toContain("conversion?.event_id || eventId");
    expect(endpoint).toContain(
      'stage === "sale" && (!Number.isFinite(value) || value <= 0)'
    );
    expect(endpoint).not.toContain("META_VALUE_QUALIFIED");
    expect(endpoint).not.toContain("META_VALUE_SCHEDULE");
    expect(endpoint).not.toContain("META_VALUE_SHOWED");
    expect(endpoint).not.toContain("configuredValues");
    expect(endpoint).toContain("first_url: lead.first_url");
    expect(endpoint).toContain(
      "original_query_string: lead.original_query_string"
    );
    expect(endpoint).toContain("lead.fbc");
    expect(endpoint).toContain("lead.fbp");
    expect(endpoint).toContain("lead.ip_address");
    expect(endpoint).toContain("lead.user_agent");
  });

  it("keeps secret values out of browser files and browser-safe profile DTOs", () => {
    const browserSource = generatedFiles()
      .filter(
        file => file.path.startsWith("public/") || file.path.endsWith(".astro")
      )
      .map(file => file.contents)
      .join("\n");
    const fixtureSecrets = buildReadyPaidFunnelSecrets() as Record<
      string,
      string | undefined
    >;
    const secretValues =
      SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets
        .map(key => fixtureSecrets[key])
        .filter((value): value is string => Boolean(value));
    const dto = JSON.stringify(buildReadyPaidFunnelProfileDto());
    for (const value of secretValues) {
      expect(browserSource).not.toContain(value);
      expect(dto).not.toContain(value);
    }
  });
});
