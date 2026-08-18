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
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "./simpleFormContract";

const missingSecrets = {
  META_CAPI_ACCESS_TOKEN: false,
  GHL_API_KEY: false,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: false,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: false,
  STAGE_WEBHOOK_SECRET: false,
  ALERT_WEBHOOK_URL: false,
};

const readySecrets = {
  META_CAPI_ACCESS_TOKEN: true,
  GHL_API_KEY: true,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: true,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: true,
  STAGE_WEBHOOK_SECRET: true,
  ALERT_WEBHOOK_URL: false,
};

const readyIntegration = {
  GHL_LOCATION_ID: "location-123",
  GOOGLE_SHEETS_ID: "sheet-123",
  META_PIXEL_ID: "123456789012345",
};

function buildReadyRecord(): SimpleFormStoredRecord {
  const record = buildSimpleFormStoredRecord({
    businessName: "Northland Spas",
    slug: "northland-spas-simple-form",
    phone: "+17015551234",
  });
  record.config.meta.pixelId = "123456789012345";
  record.config.serviceAreaZipCodes = ["58701"];
  record.config.inventory.products = record.config.inventory.products.map(
    (product, index) => ({
      ...product,
      ctaUrl: `https://northland.example/products/${index + 1}`,
    })
  );
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
    expect(
      config.inventory.products.every(product => product.ctaUrl === "")
    ).toBe(true);
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
    const readiness = buildSimpleFormReadiness(record, missingSecrets, {
      GHL_LOCATION_ID: "",
      GOOGLE_SHEETS_ID: "",
      META_PIXEL_ID: "",
    });
    expect(readiness.published).toBe(false);
    expect(readiness.configurationReady).toBe(false);
    const missing = readiness.sections.flatMap(section => section.missing);
    expect(missing).toContain("Client phone (E.164)");
    expect(missing).toContain("Meta Pixel ID");
    expect(missing).toContain("Meta CAPI Access Token");
    expect(missing).toContain("GHL Location ID");
    expect(missing).toContain("GHL API Key");
    expect(missing).toContain("Google Sheet ID");
    expect(missing).toContain("Google service-account email");
    expect(missing).toContain("Google service-account private key");
    expect(missing).toContain("Lifecycle Callback Secret");
    expect(missing.some(item => item.includes("CTA URL"))).toBe(true);
  });

  it("marks a complete canonical Shape A candidate ready", () => {
    const readiness = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      readyIntegration
    );

    expect(readiness.configurationReady).toBe(true);
    expect(readiness.published).toBe(false);
  });

  it("derives published from a completed publish job with a live URL", () => {
    const unpublished = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      readyIntegration
    );
    const published = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      readyIntegration,
      undefined,
      { published: true }
    );
    expect(unpublished.published).toBe(false);
    expect(published.published).toBe(true);
    expect(published.configurationReady).toBe(true);
  });

  it.each([
    ["STAGE_WEBHOOK_SECRET", "Lifecycle Callback Secret", "productionSecrets"],
    ["META_CAPI_ACCESS_TOKEN", "Meta CAPI Access Token", "meta"],
    ["GHL_API_KEY", "GHL API Key", "ghl"],
    [
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "Google service-account email",
      "googleSheets",
    ],
    [
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "Google service-account private key",
      "googleSheets",
    ],
  ] as const)(
    "requires offline conversion runtime secret %s",
    (runtimeKey, missingLabel, sectionKey) => {
      const readiness = buildSimpleFormReadiness(
        buildReadyRecord(),
        { ...readySecrets, [runtimeKey]: false },
        readyIntegration
      );

      expect(readiness.configurationReady).toBe(false);
      expect(
        readiness.sections.find(section => section.key === sectionKey)?.missing
      ).toContain(missingLabel);
    }
  );

  it("blocks readiness when the offline conversion contract is missing", () => {
    const readiness = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      readyIntegration,
      null
    );

    expect(readiness.configurationReady).toBe(false);
    expect(
      readiness.sections.find(section => section.key === "offlineConversion")
        ?.missing
    ).toContain("Canonical offline conversion contract");
  });

  it("blocks readiness when the offline conversion contract drifts", () => {
    const readiness = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      readyIntegration,
      {
        ...SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
        joinKey: "leadId",
      }
    );

    expect(readiness.configurationReady).toBe(false);
    expect(
      readiness.sections.find(section => section.key === "offlineConversion")
        ?.missing
    ).toContain("Canonical offline conversion contract");
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

    const readiness = buildSimpleFormReadiness(
      record,
      readySecrets,
      readyIntegration
    );

    expect(readiness.configurationReady).toBe(false);
  });

  it("rejects an invalid client Meta Pixel ID", () => {
    const readiness = buildSimpleFormReadiness(
      buildReadyRecord(),
      readySecrets,
      {
        ...readyIntegration,
        META_PIXEL_ID: "not-a-pixel-id",
      }
    );

    expect(readiness.configurationReady).toBe(false);
  });

  it("returns transformed validated config without integration secrets", () => {
    const record = buildReadyRecord();
    record.config.meta.currency = "usd";
    record.config.validation.defaultCountry = "us";

    const validated = buildSimpleFormValidatedConfiguration(record.config);

    expect(validated?.meta.currency).toBe("USD");
    expect(validated?.validation.defaultCountry).toBe("US");
    expect(validated).not.toHaveProperty("ghlWebhookUrl");
    expect(JSON.stringify(validated)).not.toContain("meta-token");
  });
});

describe("Simple Form helpers", () => {
  it("parses unique 5-digit ZIP lists", () => {
    expect(parseServiceAreaZips("58701, 58702\n58701")).toEqual([
      "58701",
      "58702",
    ]);
  });

  it("builds a client-specific slug without colliding", () => {
    expect(simpleFormFunnelSlug("Northland", [])).toBe("northland-simple-form");
    expect(simpleFormFunnelSlug("Northland", ["northland-simple-form"])).toBe(
      "northland-simple-form-2"
    );
  });

  it("falls back to the template logo when selected client media is missing", () => {
    const record = buildReadyRecord();
    record.config.client.logoUrl = "https://cdn.example/stale-logo.png";
    record.imageSources.logo = { mode: "client-media", slot: "logo" };

    expect(resolveSimpleFormImages(record, []).client.logoUrl).toBe(
      SIMPLE_FORM_TEMPLATE_LOGO_URL
    );
  });
});
