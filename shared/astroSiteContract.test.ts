import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ASTRO_SITE_APPROVED_SOURCE_SHA,
  ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS,
  ASTRO_SITE_MANIFEST,
  ASTRO_SITE_REQUIRED_RUNTIME_SECRETS,
  astroSiteManifestSchema,
  getAstroSiteRuntimeSecrets,
} from "./astroSiteContract";

describe("Astro website template contract", () => {
  it("pins an exact reviewed canonical source commit", () => {
    expect(ASTRO_SITE_APPROVED_SOURCE_SHA).toMatch(/^[0-9a-f]{40}$/);
  });
  it("models the exact canonical repository, config, workflow, and bindings", () => {
    const raw = JSON.parse(
      readFileSync(
        "server/templates/astro-site/launchpad.template.json",
        "utf8",
      ),
    );

    expect(astroSiteManifestSchema.parse(raw)).toEqual(ASTRO_SITE_MANIFEST);
    expect(ASTRO_SITE_MANIFEST).toMatchObject({
      schemaVersion: 1,
      contractVersion: 1,
      templateKey: "htl-astro-website",
      repo: "increaseroasir/32-htl-website-template-astrobuild",
      defaultBranch: "main",
      type: "website",
      framework: "astro",
      configPath: "src/config/client.config.ts",
      workflow: "deploy.yml",
      bindings: {
        d1: { binding: "DB" },
        r2: { binding: "PRODUCT_IMAGES", public: true },
      },
    });
  });

  it("keeps required and conditional runtime secrets exact and ordered", () => {
    expect(ASTRO_SITE_REQUIRED_RUNTIME_SECRETS).toEqual([
      "ADMIN_PASSWORD",
      "ADMIN_SESSION_SECRET",
    ]);
    expect(ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS).toEqual({
      ghl: ["GHL_API_KEY", "GHL_LOCATION_ID"],
      meta: [
        "META_PIXEL_ID",
        "META_CAPI_ACCESS_TOKEN",
        "STAGE_WEBHOOK_SECRET",
      ],
    });
    expect(getAstroSiteRuntimeSecrets({ ghl: true, meta: false })).toEqual([
      "ADMIN_PASSWORD",
      "ADMIN_SESSION_SECRET",
      "GHL_API_KEY",
      "GHL_LOCATION_ID",
    ]);
  });

  it("rejects manifest drift and unknown fields", () => {
    expect(() =>
      astroSiteManifestSchema.parse({
        ...ASTRO_SITE_MANIFEST,
        configPath: "src/config/site.ts",
      }),
    ).toThrow();
    expect(() =>
      astroSiteManifestSchema.parse({
        ...ASTRO_SITE_MANIFEST,
        unexpected: true,
      }),
    ).toThrow();
  });
});
