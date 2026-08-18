import { describe, expect, it } from "vitest";
import {
  ASSET_SLOT_FILENAMES,
  ASSET_SLOT_VALUES,
  BUSINESS_DAY_VALUES,
  buildReadiness,
  clientInputSchema,
  draftClientInputSchema,
  type ClientInput,
} from "./client";

export const validClientInput: ClientInput = {
  businessName: "Paradise Spas",
  shortName: "Paradise",
  phone: "+17015551234",
  email: "hello@paradisespas.example",
  streetAddress: "123 Main Street",
  city: "Minot",
  state: "North Dakota",
  postalCode: "58701",
  country: "United States",
  websiteUrl: "https://paradisespas.example",
  foundedYear: 1994,
  tagline: "Relaxation starts here.",
  theme: "aqua",
  businessHours: BUSINESS_DAY_VALUES.map((day, index) => ({
    day,
    isOpen: index < 6,
    opensAt: "09:00",
    closesAt: "17:00",
  })),
  facebookUrl: "https://www.facebook.com/paradisespas",
  googleMapsUrl: "https://maps.app.goo.gl/example",
  productCategories: ["hotTubs", "swimSpas"],
  primaryOffer: "Save on select models this month.",
  financingPromise: "Flexible monthly payment options are available.",
  deliveryPromise: "Local delivery and setup are available.",
};

const completeSecrets = {
  metaPixelId: true,
  ga4MeasurementId: true,
  clarityId: true,
  ghlApiKey: true,
  ghlWebhookUrl: true,
  cloudflareProjectName: true,
};

describe("client input validation", () => {
  it("accepts a complete client configuration", () => {
    expect(clientInputSchema.safeParse(validClientInput).success).toBe(true);
  });

  it("rejects a phone number that is not in E.164 format", () => {
    const result = clientInputSchema.safeParse({ ...validClientInput, phone: "701-555-1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Facebook address in the Facebook field", () => {
    const result = clientInputSchema.safeParse({
      ...validClientInput,
      facebookUrl: "https://example.com/profile",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Google address in the Google Maps field", () => {
    const result = clientInputSchema.safeParse({
      ...validClientInput,
      googleMapsUrl: "https://example.com/map",
    });
    expect(result.success).toBe(false);
  });

  it("does not throw while an address is empty or partially typed", () => {
    expect(() =>
      clientInputSchema.safeParse({ ...validClientInput, websiteUrl: "https://" }),
    ).not.toThrow();
  });

  it("accepts a draft client with only a business name", () => {
    expect(draftClientInputSchema.safeParse({ businessName: "Northland Spas" }).success).toBe(true);
    expect(draftClientInputSchema.safeParse({ businessName: "A" }).success).toBe(false);
  });
});

describe("readiness", () => {
  it("is complete only when every required detail, asset, and setup value is present", () => {
    const readiness = buildReadiness(validClientInput, ASSET_SLOT_VALUES, completeSecrets);
    expect(readiness).toMatchObject({ completed: 14, total: 14, percent: 100, isComplete: true });
  });

  it("reports each missing asset and setup value", () => {
    const readiness = buildReadiness(validClientInput, ["logo", "hero"], {
      ...completeSecrets,
      metaPixelId: false,
    });
    expect(readiness.isComplete).toBe(false);
    expect(readiness.items.find(item => item.key === "asset-delivery")?.complete).toBe(false);
    expect(readiness.items.find(item => item.key === "secret-metaPixelId")?.complete).toBe(false);
  });

  it("does not let missing GA4 or Clarity block overall launch readiness", () => {
    const readiness = buildReadiness(validClientInput, ASSET_SLOT_VALUES, {
      ...completeSecrets,
      ga4MeasurementId: false,
      clarityId: false,
    });
    expect(readiness.total).toBe(14);
    expect(readiness.isComplete).toBe(true);
    expect(readiness.items.find(item => item.key === "secret-ga4MeasurementId")?.complete).toBe(
      false,
    );
  });

  it("uses the deterministic filenames expected by the website template", () => {
    expect(ASSET_SLOT_FILENAMES).toEqual({
      logo: "logo.webp",
      hero: "hero.webp",
      hotTubs: "category-hot-tubs.webp",
      swimSpas: "category-swim-spas.webp",
      showroom: "showroom.webp",
      product: "product.webp",
      delivery: "delivery.webp",
    });
  });
});
