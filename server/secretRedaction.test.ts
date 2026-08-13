import { describe, expect, it } from "vitest";
import {
  toClientAstroConfigView,
  toClientFunnelBuilderDetail,
} from "./secretRedaction";

describe("client DTO redaction", () => {
  it("strips pixel, webhook, and generated funnel config from get responses", () => {
    const client = toClientFunnelBuilderDetail(
      {
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
      },
      { includeGeneratedConfig: false },
    );

    const serialized = JSON.stringify(client);
    expect(client.profile.hasMetaPixelId).toBe(true);
    expect(client.profile.hasGhlWebhookUrl).toBe(true);
    expect(client.config.hasGeneratedConfig).toBe(true);
    expect(client.config.generatedConfig).toBe("");
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("leadconnectorhq");
  });

  it("keeps generated funnel config on save so operators can copy the file once", () => {
    const client = toClientFunnelBuilderDetail(
      {
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
          ghlWebhookUrl: "https://hooks.example/secret-path",
          missingSetup: [],
        },
      },
      { includeGeneratedConfig: true },
    );

    expect(client.config.generatedConfig).toContain("funnelConfig");
    expect(JSON.stringify(client.profile)).not.toContain("1234567890");
    expect(JSON.stringify(client.profile)).not.toContain("secret-path");
  });

  it("omits decrypted Astro generated config on get", () => {
    const client = toClientAstroConfigView(
      {
        clientId: 5,
        generatedConfig: "export const clientConfig = { pixel: 'raw-secret-pixel' };",
        secretStatus: { GHL_API_KEY: true },
      },
      { includeGeneratedConfig: false },
    );

    expect(client.generatedConfig).toBe("");
    expect(client.hasGeneratedConfig).toBe(true);
    expect(JSON.stringify(client)).not.toContain("raw-secret-pixel");
  });
});
