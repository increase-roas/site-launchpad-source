import { describe, expect, it } from "vitest";
import {
  DEPLOY_SUCCESS_MESSAGE,
  defaultServiceArea,
  funnelEditorInputSchema,
  funnelFormStepCount,
  funnelStepCount,
  generateFunnelConfig,
  surveyQuestionInputSchema,
} from "./funnelConfig";

const baseInput = {
  name: "Hot Tub Quiz",
  slug: "hot-tub-quiz",
  serviceArea: "Minot, North Dakota, 58701, United States",
  offerHeadline: "Save on select hot tubs",
  offerSubheadline: "Find the right model for your home.",
  thankYouMessage: "Thanks! We will call you shortly.",
  questions: [
    {
      questionText: "What size hot tub are you looking for?",
      questionType: "radio" as const,
      options: ["2–3 people", "4–5 people", "6+ people"],
    },
    {
      questionText: "Anything else we should know?",
      questionType: "text" as const,
      options: [],
    },
  ],
};

describe("funnel question validation", () => {
  it("accepts choice questions with at least two unique options", () => {
    expect(surveyQuestionInputSchema.safeParse(baseInput.questions[0]).success).toBe(true);
  });

  it("rejects choice questions with too few or duplicate options", () => {
    expect(
      surveyQuestionInputSchema.safeParse({
        questionText: "Choose one",
        questionType: "radio",
        options: ["Same"],
      }).success,
    ).toBe(false);
    expect(
      surveyQuestionInputSchema.safeParse({
        questionText: "Choose any",
        questionType: "checkbox",
        options: ["Same", "same"],
      }).success,
    ).toBe(false);
  });

  it("requires text questions to have no answer choices", () => {
    expect(
      surveyQuestionInputSchema.safeParse({
        questionText: "Tell us more",
        questionType: "text",
        options: ["Unexpected"],
      }).success,
    ).toBe(false);
  });
});

describe("generated funnel config", () => {
  it("counts ZIP, survey questions, contact, and thank-you steps", () => {
    expect(funnelFormStepCount(0)).toBe(2);
    expect(funnelFormStepCount(2)).toBe(4);
    expect(funnelStepCount(0)).toBe(3);
    expect(funnelStepCount(2)).toBe(5);
  });

  it("generates deterministic TypeScript content in the saved question order", () => {
    const source = {
      ...baseInput,
      businessName: "Paradise Spas",
      phone: "+17015551234",
      metaPixelId: "1234567890",
      ghlWebhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    };
    const first = generateFunnelConfig(source);
    const second = generateFunnelConfig(source);

    expect(first).toBe(second);
    expect(first).toContain("export const funnelConfig");
    expect(first.indexOf("What size hot tub")).toBeLessThan(first.indexOf("Anything else"));
    expect(first).toContain('"metaPixelId": "1234567890"');
    expect(first).toContain('"ghlWebhookUrl": "https://services.leadconnectorhq.com/hooks/example"');
    expect(first).toContain('"type": "thankYou"');
  });

  it("validates the full editor payload and builds the address-based service area", () => {
    expect(funnelEditorInputSchema.safeParse(baseInput).success).toBe(true);
    expect(
      defaultServiceArea({
        city: "Minot",
        state: "ND",
        postalCode: "58701",
        country: "United States",
      }),
    ).toBe("Minot, ND, 58701, United States");
  });

  it("uses the exact required Wrangler instruction", () => {
    expect(DEPLOY_SUCCESS_MESSAGE).toBe(
      "Funnel config generated. Run `npx wrangler deploy` in the funnel template folder to go live.",
    );
  });
});
