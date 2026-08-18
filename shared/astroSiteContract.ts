import { z } from "zod";
import astroSiteManifestJson from "../server/templates/astro-site/launchpad.template.json";

export const ASTRO_SITE_TEMPLATE_KEY = "htl-astro-website" as const;
export const ASTRO_SITE_APPROVED_SOURCE_SHA =
  "2ced3065460a31a497df96b214e2a0f0ace27f3d" as const;

export const astroSiteManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contractVersion: z.literal(1),
  templateKey: z.literal(ASTRO_SITE_TEMPLATE_KEY),
  name: z.literal("HTL Astro Website"),
  repo: z.literal("increaseroasir/32-htl-website-template-astrobuild"),
  defaultBranch: z.literal("main"),
  type: z.literal("website"),
  framework: z.literal("astro"),
  active: z.literal(true),
  configPath: z.literal("src/config/client.config.ts"),
  workflow: z.literal("deploy.yml"),
  bindings: z.strictObject({
    d1: z.strictObject({ binding: z.literal("DB") }),
    r2: z.strictObject({
      binding: z.literal("PRODUCT_IMAGES"),
      public: z.literal(true),
    }),
  }),
  runtimeSecrets: z.strictObject({
    required: z.tuple([
      z.literal("ADMIN_PASSWORD"),
      z.literal("ADMIN_SESSION_SECRET"),
    ]),
    conditional: z.strictObject({
      ghl: z.tuple([
        z.literal("GHL_API_KEY"),
        z.literal("GHL_LOCATION_ID"),
      ]),
      meta: z.tuple([
        z.literal("META_PIXEL_ID"),
        z.literal("META_CAPI_ACCESS_TOKEN"),
        z.literal("STAGE_WEBHOOK_SECRET"),
      ]),
    }),
  }),
});

export type AstroSiteManifest = z.infer<typeof astroSiteManifestSchema>;

export const ASTRO_SITE_MANIFEST = astroSiteManifestSchema.parse(
  astroSiteManifestJson,
);

export const ASTRO_SITE_REQUIRED_RUNTIME_SECRETS =
  ASTRO_SITE_MANIFEST.runtimeSecrets.required;
export const ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS =
  ASTRO_SITE_MANIFEST.runtimeSecrets.conditional;

export type AstroSiteConditionalIntegration =
  keyof typeof ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS;

export function getAstroSiteRuntimeSecrets(
  enabledIntegrations: Partial<Record<AstroSiteConditionalIntegration, boolean>>,
): string[] {
  return [
    ...ASTRO_SITE_REQUIRED_RUNTIME_SECRETS,
    ...Object.entries(ASTRO_SITE_CONDITIONAL_RUNTIME_SECRETS).flatMap(
      ([integration, secrets]) =>
        enabledIntegrations[integration as AstroSiteConditionalIntegration]
          ? secrets
          : [],
    ),
  ];
}
