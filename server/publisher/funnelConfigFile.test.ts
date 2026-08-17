import { describe, expect, it } from "vitest";
import {
  buildSimpleFormOperatorDefaults,
  buildSimpleFormValidatedConfiguration,
  type SimpleFormValidatedConfiguration,
} from "../../shared/simpleFormConfig";
import {
  SAFE_GHL_WEBHOOK_PLACEHOLDER,
  renderFunnelConfigTs,
} from "./funnelConfigFile";

function validatedConfiguration(): SimpleFormValidatedConfiguration {
  const operatorConfig = buildSimpleFormOperatorDefaults({
    businessName: "Northland Spas",
    slug: "northland-simple-form",
    phone: "+17015551234",
  });
  operatorConfig.meta.pixelId = "12345678";
  operatorConfig.serviceAreaZipCodes = ["58701"];
  operatorConfig.inventory.products = operatorConfig.inventory.products.map(
    product => ({
      ...product,
      ctaUrl: "https://example.com/inventory",
    })
  );
  const validated = buildSimpleFormValidatedConfiguration(operatorConfig, {
    GHL_WEBHOOK_URL: "https://example.invalid/validation-placeholder",
  });
  if (!validated) throw new Error("Expected valid test configuration.");
  return validated;
}

describe("funnel.config.ts renderer", () => {
  it("renders deterministic TypeScript with only the schema-required safe placeholder", () => {
    const config = validatedConfiguration();

    const first = renderFunnelConfigTs(config);
    const second = renderFunnelConfigTs(config);

    expect(first).toBe(second);
    expect(first).toContain(
      'import { defineFunnelConfig } from "./src/lib/config-schema";'
    );
    expect(first).toContain('"slug": "northland-simple-form"');
    expect(first).toContain(
      `"ghlWebhookUrl": "${SAFE_GHL_WEBHOOK_PLACEHOLDER}"`
    );
    expect(first).not.toContain("validation-placeholder");
    expect(first).toMatch(
      /export default defineFunnelConfig\(\{[\s\S]+\}\);\n$/
    );
  });

  it("strips unexpected secret-shaped properties before rendering", () => {
    const config = {
      ...validatedConfiguration(),
      GHL_WEBHOOK_URL: "opaque-value-that-must-not-render",
    };

    const rendered = renderFunnelConfigTs(config);

    expect(rendered).not.toContain("GHL_WEBHOOK_URL");
    expect(rendered).not.toContain("opaque-value-that-must-not-render");
  });
});
