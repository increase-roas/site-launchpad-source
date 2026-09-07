import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ASTRO_SITE_APPROVED_SOURCE_SHA,
  ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS,
  ASTRO_SITE_MANIFEST,
  ASTRO_SITE_REQUIRED_RUNTIME_SECRETS,
  astroSiteManifestSchema,
  getAstroSiteRuntimeSecrets,
  templateHeadBlocksRepositoryCreate,
} from "./astroSiteContract";

describe("Astro website template contract", () => {
  it("lets new repositories follow the live template main commit", () => {
    expect(
      templateHeadBlocksRepositoryCreate(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ASTRO_SITE_APPROVED_SOURCE_SHA,
      ),
    ).toBe(false);
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
      repo: "increase-roas/32-htl-website-template-astrobuild",
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
