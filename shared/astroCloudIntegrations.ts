import type { AstroClientConfigInput } from "./astroConfig";
import { ASTRO_SITE_MANIFEST } from "./astroSiteContract";
import { astroSitePreviewResourceNames } from "./astroSitePreview";

export function fillEnabledAstroCloudIntegrations(
  integrations: AstroClientConfigInput["integrations"],
  resources: {
    clientId: number;
    shortName: string;
    d1DatabaseName?: string;
    r2BucketName?: string;
  },
): AstroClientConfigInput["integrations"] {
  const names = astroSitePreviewResourceNames(resources.shortName, resources.clientId);
  const d1DatabaseName = resources.d1DatabaseName?.trim() || names.d1DatabaseName;
  const r2BucketName = resources.r2BucketName?.trim() || names.r2BucketName;
  const next = {
    ...integrations,
    d1: { ...integrations.d1, config: { ...integrations.d1.config } },
    r2: { ...integrations.r2, config: { ...integrations.r2.config } },
  };

  if (next.d1.enabled) {
    if (!next.d1.config.binding?.trim()) {
      next.d1.config.binding = ASTRO_SITE_MANIFEST.bindings.d1.binding;
    }
    if (!next.d1.config.databaseName?.trim()) {
      next.d1.config.databaseName = d1DatabaseName;
    }
  }
  if (next.r2.enabled) {
    if (!next.r2.config.binding?.trim()) {
      next.r2.config.binding = ASTRO_SITE_MANIFEST.bindings.r2.binding;
    }
    if (!next.r2.config.bucketName?.trim()) {
      next.r2.config.bucketName = r2BucketName;
    }
  }

  return next;
}
