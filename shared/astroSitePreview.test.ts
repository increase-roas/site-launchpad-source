import { describe, expect, it } from "vitest";
import { createDefaultAstroConfig } from "./astroConfig";
import { BUSINESS_DAY_VALUES } from "./client";
import { ASTRO_SITE_APPROVED_SOURCE_SHA } from "./astroSiteContract";
import {
  astroSitePreviewProgress,
  astroSitePreviewResourceNames,
  astroSitePreviewStepLabel,
  parseGeneratedAstroClientConfig,
  pinnedPreviewTemplateSha,
  previewIsStale,
  validateAstroSitePreview,
} from "./astroSitePreview";

const config = createDefaultAstroConfig({
  businessName: "ABC Hot Tubs",
  shortName: "abc-hot-tubs",
  foundedYear: 1994,
  tagline: "Relax better",
  websiteUrl: "https://abc.example.com",
  phone: "+17015551234",
  email: "hello@abc.example.com",
  streetAddress: "1 Main Street",
  city: "Minot",
  state: "ND",
  postalCode: "58701",
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

describe("Astro site preview resource names", () => {
  it("keeps the client repository and isolates preview Worker and D1", () => {
    expect(astroSitePreviewResourceNames("ABC Hot Tubs", 7)).toEqual({
      externalSiteId: "astro-site-preview-client-7",
      resourceName: "website-abc-hot-tubs-7",
      repositoryName: "website-abc-hot-tubs-7",
      workerName: "website-abc-hot-tubs-7-preview",
      d1DatabaseName: "website-abc-hot-tubs-7-preview-inventory",
      r2BucketName: "website-abc-hot-tubs-7-images",
      sessionKvTitle: "website-abc-hot-tubs-7-preview-session",
    });
  });

  it("bounds every Cloudflare resource name including the preview D1 suffix", () => {
    const names = astroSitePreviewResourceNames("A".repeat(200), 9);
    expect(names.workerName.length).toBeLessThanOrEqual(63);
    expect(names.d1DatabaseName.length).toBeLessThanOrEqual(63);
    expect(names.r2BucketName.length).toBeLessThanOrEqual(63);
    expect(names.sessionKvTitle.length).toBeLessThanOrEqual(63);
    expect(names.d1DatabaseName.endsWith("-preview-inventory")).toBe(true);
    expect(names.sessionKvTitle.endsWith("-preview-session")).toBe(true);
  });
});

describe("preview validation", () => {
  it("blocks only when the generated site would be invalid", () => {
    const result = validateAstroSitePreview({
      businessName: "",
      shortName: "",
      theme: null,
      generatedConfig: "",
      generatedAt: null,
      config: null,
      assets: {},
    });
    expect(result.blocking.map(issue => issue.code)).toEqual([
      "businessName",
      "shortName",
      "theme",
      "generatedConfig",
    ]);
  });

  it("warns about optional intake without blocking preview", () => {
    const generated = `export const rawClientConfig = ${JSON.stringify({
      identity: { name: "ABC Hot Tubs" },
    })};`;
    const result = validateAstroSitePreview({
      businessName: "ABC Hot Tubs",
      shortName: "abc-hot-tubs",
      theme: "aqua",
      generatedConfig: generated,
      generatedAt: new Date("2026-09-02T00:00:00Z"),
      config,
      assets: {},
      metaEnabled: true,
      metaConfigured: false,
    });
    expect(result.blocking).toEqual([]);
    expect(result.warnings.some(issue => issue.code === "favicon")).toBe(true);
    expect(result.warnings.some(issue => issue.code === "gallery")).toBe(true);
    expect(result.warnings.some(issue => issue.code === "meta")).toBe(true);
  });

  it("parses the generated client config export", () => {
    expect(
      parseGeneratedAstroClientConfig(
        'export const rawClientConfig: ClientConfigInput = {"identity":{"name":"ABC"}};',
      ),
    ).toEqual({ identity: { name: "ABC" } });
    expect(parseGeneratedAstroClientConfig("not config")).toBeNull();
  });
});

describe("preview presentation", () => {
  it("reports progress without counting the terminal marker", () => {
    expect(astroSitePreviewProgress("create_repository")).toEqual({
      completed: 0,
      total: 8,
    });
    expect(astroSitePreviewProgress("ready")).toEqual({ completed: 8, total: 8 });
  });

  it("labels pipeline steps for operators", () => {
    expect(astroSitePreviewStepLabel("verify_preview")).toBe("Verifying");
    expect(astroSitePreviewStepLabel("ready")).toBe("Preview ready");
  });

  it("detects a stale preview against the current client revision", () => {
    expect(previewIsStale({ currentRevision: 28, previewRevision: 27 })).toBe(true);
    expect(previewIsStale({ currentRevision: 27, previewRevision: 27 })).toBe(false);
    expect(previewIsStale({ currentRevision: 28, previewRevision: null })).toBe(false);
  });

  it("pins previews to the approved factory SHA", () => {
    expect(pinnedPreviewTemplateSha()).toBe(ASTRO_SITE_APPROVED_SOURCE_SHA);
  });
});
