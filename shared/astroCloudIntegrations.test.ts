import { describe, expect, it } from "vitest";
import { createDefaultAstroConfig } from "./astroConfig";
import { fillEnabledAstroCloudIntegrations } from "./astroCloudIntegrations";
import { BUSINESS_DAY_VALUES } from "./client";

function baseConfig() {
  return createDefaultAstroConfig({
    businessName: "Sun Pool & Spa Supply",
    shortName: "Sun Pool",
    foundedYear: 1998,
    tagline: "Hot tubs",
    websiteUrl: "https://www.sunpoolandspasupply.com",
    phone: "+16195551212",
    email: "hello@example.com",
    streetAddress: "1 Main",
    city: "Lakeside",
    state: "CA",
    postalCode: "92040",
    country: "US",
    businessHours: BUSINESS_DAY_VALUES.map(day => ({
      day,
      isOpen: false,
      opensAt: "",
      closesAt: "",
    })),
    facebookUrl: "",
    theme: "aqua",
  });
}

describe("fillEnabledAstroCloudIntegrations", () => {
  it("fills D1 and R2 bindings and preview resource names when enabled", () => {
    const config = baseConfig();
    config.integrations.d1.enabled = true;
    config.integrations.r2.enabled = true;

    const filled = fillEnabledAstroCloudIntegrations(config.integrations, {
      clientId: 17,
      shortName: config.identity.shortName,
    });

    expect(filled.d1.config).toEqual({
      binding: "DB",
      databaseName: "website-sun-pool-17-preview-inventory",
    });
    expect(filled.r2.config).toEqual({
      binding: "PRODUCT_IMAGES",
      bucketName: "website-sun-pool-17-images",
    });
  });

  it("keeps operator-entered names and leaves disabled integrations blank", () => {
    const config = baseConfig();
    config.integrations.d1 = {
      enabled: true,
      config: { binding: "CUSTOM_DB", databaseName: "custom-inventory" },
    };

    const filled = fillEnabledAstroCloudIntegrations(config.integrations, {
      clientId: 17,
      shortName: config.identity.shortName,
    });

    expect(filled.d1.config).toEqual({
      binding: "CUSTOM_DB",
      databaseName: "custom-inventory",
    });
    expect(filled.r2.enabled).toBe(false);
    expect(filled.r2.config.binding).toBe("");
    expect(filled.r2.config.bucketName).toBe("");
  });
});
