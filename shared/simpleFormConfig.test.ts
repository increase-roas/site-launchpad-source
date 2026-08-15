import { describe, expect, it } from "vitest";
import {
  SIMPLE_FORM_TEMPLATE_LOGO_URL,
  buildSimpleFormOperatorDefaults,
  buildSimpleFormReadiness,
  buildSimpleFormStoredRecord,
  buildSimpleFormValidatedConfiguration,
  parseServiceAreaZips,
  resolveSimpleFormImages,
  simpleFormFunnelSlug,
  type SimpleFormStoredRecord,
} from "./simpleFormConfig";

const missingSecrets = {
  META_CAPI_ACCESS_TOKEN: false,
  META_TEST_EVENT_CODE: false,
  GHL_WEBHOOK_URL: false,
  CRM_CALLBACK_SECRET: false,
  SUBMISSION_ALERT_WEBHOOK_URL: false,
};

const readySecrets = {
  META_CAPI_ACCESS_TOKEN: true,
  META_TEST_EVENT_CODE: false,
  GHL_WEBHOOK_URL: true,
  CRM_CALLBACK_SECRET: true,
  SUBMISSION_ALERT_WEBHOOK_URL: false,
};

function buildReadyRecord(): SimpleFormStoredRecord {
  const record = buildSimpleFormStoredRecord({
    businessName: "Northland Spas",
    slug: "northland-spas-simple-form",
    phone: "+17015551234",
  });
  record.config.meta.pixelId = "123456789012345";
  record.config.serviceAreaZipCodes = ["58701"];
  record.config.inventory.products = record.config.inventory.products.map((product, index) => ({
    ...product,
    ctaUrl: `https://northland.example/products/${index + 1}`,
  }));
  return record;
}

describe("Simple Form operator defaults", () => {
  it("uses the client name and does not invent phone, pixel, webhook, or ZIP data", () => {
    const config = buildSimpleFormOperatorDefaults({
      businessName: "Northland Spas",
      slug: "northland-spas-simple-form",
    });
    expect(config.client.name).toBe("Northland Spas");
    expect(config.client.phone).toBe("");
    expect(config.meta.pixelId).toBe("");
    expect(config.serviceAreaZipCodes).toEqual([]);
    expect(config.inventory.products).toHaveLength(5);
    expect(config.inventory.products.every(product => product.ctaUrl === "")).toBe(true);
    expect(config.funnel.shape).toBe("A");
    expect(config.surveyQuestions).toEqual([]);
  });

  it("keeps template default product images", () => {
    const config = buildSimpleFormOperatorDefaults({
      businessName: "Northland Spas",
      slug: "northland-spas-simple-form",
    });
    expect(config.inventory.products[0]?.imageUrl).toContain("unsplash.com");
  });
});

describe("Simple Form readiness", () => {
  it("lists missing client, meta, ghl, inventory, and production secrets on a new funnel", () => {
    const record = buildSimpleFormStoredRecord({
      businessName: "Northland Spas",
      slug: "northland-spas-simple-form",
    });
    const readiness = buildSimpleFormReadiness(record, missingSecrets);
    expect(readiness.published).toBe(false);
    expect(readiness.configurationReady).toBe(false);
    const missing = readiness.sections.flatMap(section => section.missing);
    expect(missing).toContain("Client phone (E.164)");
    expect(missing).toContain("Meta Pixel ID");
    expect(missing).toContain("Meta CAPI Access Token");
    expect(missing).toContain("GHL Webhook URL");
    expect(missing).toContain("CRM Callback Secret");
    expect(missing.some(item => item.includes("CTA URL"))).toBe(true);
  });

  it("fails production secrets when a Meta test event code is present", () => {
    const record = buildSimpleFormStoredRecord({
      businessName: "Northland Spas",
      slug: "northland-spas-simple-form",
      phone: "+17015551234",
    });
    record.config.meta.pixelId = "123456789012345";
    const readiness = buildSimpleFormReadiness(record, {
      META_CAPI_ACCESS_TOKEN: true,
      META_TEST_EVENT_CODE: true,
      GHL_WEBHOOK_URL: true,
      CRM_CALLBACK_SECRET: true,
      SUBMISSION_ALERT_WEBHOOK_URL: false,
    });
    expect(
      readiness.sections
        .find(section => section.key === "productionSecrets")
        ?.missing,
    ).toContain("Remove Meta Test Event Code before production");
  });

  it("marks a complete canonical Shape A candidate ready", () => {
    const readiness = buildSimpleFormReadiness(buildReadyRecord(), readySecrets, {
      GHL_WEBHOOK_URL: "https://services.leadconnectorhq.com/hooks/example",
    });

    expect(readiness.configurationReady).toBe(true);
  });

  it.each([
    [
      "product image URL",
      (record: SimpleFormStoredRecord) => {
        record.config.inventory.products[0].imageUrl = "not-a-url";
      },
    ],
    [
      "short product description",
      (record: SimpleFormStoredRecord) => {
        record.config.inventory.products[0].description = "short";
      },
    ],
    [
      "short price label",
      (record: SimpleFormStoredRecord) => {
        record.config.inventory.products[0].priceLabel = "x";
      },
    ],
    [
      "optional GA4 measurement ID while enhanced conversions are disabled",
      (record: SimpleFormStoredRecord) => {
        record.config.googleEnhancedConversions = false;
        record.config.ga4MeasurementId = "invalid";
      },
    ],
    [
      "calendar URL",
      (record: SimpleFormStoredRecord) => {
        record.config.calendarUrl = "not-a-url";
      },
    ],
    [
      "inventory page URL",
      (record: SimpleFormStoredRecord) => {
        record.config.inventory.pageUrl = "not-a-url";
      },
    ],
  ])("rejects an invalid canonical %s", (_label, mutate) => {
    const record = buildReadyRecord();
    mutate(record);

    const readiness = buildSimpleFormReadiness(record, readySecrets, {
      GHL_WEBHOOK_URL: "https://services.leadconnectorhq.com/hooks/example",
    });

    expect(readiness.configurationReady).toBe(false);
  });

  it("rejects an invalid stored GHL webhook URL", () => {
    const readiness = buildSimpleFormReadiness(buildReadyRecord(), readySecrets, {
      GHL_WEBHOOK_URL: "not-a-url",
    });

    expect(readiness.configurationReady).toBe(false);
  });

  it("returns transformed validated config without the GHL webhook secret", () => {
    const record = buildReadyRecord();
    record.config.meta.currency = "usd";
    record.config.validation.defaultCountry = "us";

    const validated = buildSimpleFormValidatedConfiguration(record.config, {
      GHL_WEBHOOK_URL: "https://services.leadconnectorhq.com/hooks/example",
    });

    expect(validated?.meta.currency).toBe("USD");
    expect(validated?.validation.defaultCountry).toBe("US");
    expect(validated).not.toHaveProperty("ghlWebhookUrl");
    expect(JSON.stringify(validated)).not.toContain(
      "https://services.leadconnectorhq.com/hooks/example",
    );
  });
});

describe("Simple Form helpers", () => {
  it("parses unique 5-digit ZIP lists", () => {
    expect(parseServiceAreaZips("58701, 58702\n58701")).toEqual(["58701", "58702"]);
  });

  it("builds a client-specific slug without colliding", () => {
    expect(simpleFormFunnelSlug("Northland", [])).toBe("northland-simple-form");
    expect(simpleFormFunnelSlug("Northland", ["northland-simple-form"])).toBe(
      "northland-simple-form-2",
    );
  });

  it("falls back to the template logo when selected client media is missing", () => {
    const record = buildReadyRecord();
    record.config.client.logoUrl = "https://cdn.example/stale-logo.png";
    record.imageSources.logo = { mode: "client-media", slot: "logo" };

    expect(resolveSimpleFormImages(record, []).client.logoUrl).toBe(
      SIMPLE_FORM_TEMPLATE_LOGO_URL,
    );
  });
});
