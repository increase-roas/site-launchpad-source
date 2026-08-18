import { describe, expect, it } from "vitest";
import {
  toClientAstroConfigView,
  toClientFunnelBuilderDetail,
  toGeneratedConfigExport,
} from "./secretRedaction";

const funnelDetail = {
  funnel: { id: 8, clientId: 5 },
  config: {
    serviceArea: "Minot, ND",
    offerHeadline: "Save",
    offerSubheadline: "Find a model",
    thankYouMessage: "Thanks",
    generatedConfig: "export const funnelConfig = { pixel: '1234567890' };",
    generatedAt: null,
  },
  questions: [],
  profile: {
    businessName: "Paradise Spas",
    phone: "+17015551234",
    serviceArea: "Minot, ND",
    metaPixelId: "1234567890",
    ghlWebhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    missingSetup: [],
  },
};

describe("client DTO redaction", () => {
  it("strips pixel, webhook, and generated funnel config from get and save responses", () => {
    const client = toClientFunnelBuilderDetail(funnelDetail);

    const serialized = JSON.stringify(client);
    expect(client.profile.hasMetaPixelId).toBe(true);
    expect(client.profile.hasGhlWebhookUrl).toBe(true);
    expect(client.config.hasGeneratedConfig).toBe(true);
    expect(client.config.generatedConfig).toBe("");
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("leadconnectorhq");
    expect(serialized).not.toContain("funnelConfig");
  });

  it("returns generated source only through the dedicated export payload", () => {
    const exported = toGeneratedConfigExport("funnel.config.ts", funnelDetail.config.generatedConfig);
    expect(exported.fileName).toBe("funnel.config.ts");
    expect(exported.contents).toContain("funnelConfig");
    expect(JSON.stringify(toClientFunnelBuilderDetail(funnelDetail))).not.toContain("funnelConfig");
  });

  it("omits decrypted Astro generated config on get and save", () => {
    const client = toClientAstroConfigView({
      clientId: 5,
      input: {
        integrations: {
          ghl: { enabled: true, config: { webhookUrl: "https://legacy.example/raw-webhook" } },
          meta: { enabled: true, config: { pixelId: "123456789012345" } },
        },
      },
      generatedConfig: "export const clientConfig = { pixel: 'raw-secret-pixel' };",
      secretStatus: { GHL_API_KEY: true },
    });

    expect(client.generatedConfig).toBe("");
    expect(client.hasGeneratedConfig).toBe(true);
    expect(JSON.stringify(client)).not.toContain("raw-secret-pixel");
    expect(JSON.stringify(client)).not.toContain("raw-webhook");
    expect(client.input.integrations.ghl.config).toEqual({});
    expect(client.input.integrations.meta.config).toEqual({});
  });
});
