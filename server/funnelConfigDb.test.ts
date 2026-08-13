import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSetupValue } from "./clientSecurity";
import { encryptSetupValue } from "./clientSecurity";
import {
  buildFunnelAutofillProfile,
  getFunnelDeployMissingItems,
  protectGeneratedFunnelConfig,
} from "./funnelConfigDb";

const originalSecret = process.env.JWT_SECRET;

describe("generated funnel config protection", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-funnel-config-encryption-secret";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("encrypts generated code before database persistence", () => {
    const source = "export const funnelConfig = { name: 'Test' } as const;";
    const encrypted = protectGeneratedFunnelConfig(source);
    expect(encrypted).not.toContain("funnelConfig");
    expect(decryptSetupValue(encrypted)).toBe(source);
  });

  it("autofills client identity, address service area, pixel ID, and GHL webhook from protected setup", () => {
    const profile = buildFunnelAutofillProfile(
      {
        businessName: "Paradise Spas",
        phone: "+17015551234",
        city: "Minot",
        state: "North Dakota",
        postalCode: "58701",
        country: "United States",
      },
      {
        metaPixelIdEncrypted: encryptSetupValue("1234567890"),
        ghlWebhookUrlEncrypted: encryptSetupValue(
          "https://services.leadconnectorhq.com/hooks/example",
        ),
      },
    );

    expect(profile).toMatchObject({
      businessName: "Paradise Spas",
      phone: "+17015551234",
      serviceArea: "Minot, North Dakota, 58701, United States",
      metaPixelId: "1234567890",
      ghlWebhookUrl: "https://services.leadconnectorhq.com/hooks/example",
      missingSetup: [],
    });
  });

  it("gates deployment until both setup values and generated config exist", () => {
    expect(
      getFunnelDeployMissingItems({ metaPixelId: "", ghlWebhookUrl: "", generatedConfig: "" }),
    ).toEqual(["Meta Pixel ID", "GHL webhook URL", "Generated funnel config"]);
    expect(
      getFunnelDeployMissingItems({
        metaPixelId: "1234567890",
        ghlWebhookUrl: "https://example.com/hook",
        generatedConfig: "export const funnelConfig = {};",
      }),
    ).toEqual([]);
  });
});
