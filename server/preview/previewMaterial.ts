import { randomBytes } from "node:crypto";
import { ASTRO_SITE_REQUIRED_RUNTIME_SECRETS } from "../../shared/astroSiteContract";
import {
  validateAstroSitePreview,
  type PreviewValidationIssue,
} from "../../shared/astroSitePreview";
import { decryptSetupValue, encryptSetupValue } from "../clientSecurity";
import { getAstroConfigView } from "../astroConfigDb";
import { getClientById } from "../db";
import {
  clientIntegrationProfileResolverForClient,
} from "../clientIntegrations";
import { planAstroSitePublishFromProfile } from "../studio/website/publishProfile";
import { presentProfileKeys } from "../../shared/clientIntegrationProfile";

export type AstroSitePreviewMaterialSnapshot = {
  generatedConfig: string;
  runtimeSecrets: Record<string, string>;
  clientRevision: number;
  warnings: PreviewValidationIssue[];
};

function previewAdminSecret(): string {
  return randomBytes(24).toString("hex");
}

export function protectPreviewMaterialSnapshot(
  snapshot: AstroSitePreviewMaterialSnapshot,
): string {
  return encryptSetupValue(JSON.stringify(snapshot));
}

export function readPreviewMaterialSnapshot(
  encrypted: string,
): AstroSitePreviewMaterialSnapshot {
  const parsed = JSON.parse(decryptSetupValue(encrypted)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  const record = parsed as Partial<AstroSitePreviewMaterialSnapshot>;
  if (typeof record.generatedConfig !== "string" || !record.generatedConfig.trim()) {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  if (!Number.isInteger(record.clientRevision) || (record.clientRevision ?? 0) <= 0) {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  const clientRevision = record.clientRevision;
  if (clientRevision == null) {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  if (!record.runtimeSecrets || typeof record.runtimeSecrets !== "object") {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  if (!Array.isArray(record.warnings)) {
    throw new Error("Protected preview material snapshot is invalid.");
  }
  return {
    generatedConfig: record.generatedConfig,
    runtimeSecrets: record.runtimeSecrets,
    clientRevision,
    warnings: record.warnings,
  };
}

export async function buildAstroSitePreviewSnapshot(clientId: number): Promise<{
  snapshot: AstroSitePreviewMaterialSnapshot;
  clientShortName: string;
}> {
  const [client, view] = await Promise.all([
    getClientById(clientId),
    getAstroConfigView(clientId),
  ]);
  if (!client) throw new Error("Client not found.");

  const resolver = await clientIntegrationProfileResolverForClient(clientId);
  const present = presentProfileKeys(view.integrationProfile);
  const optionalNames = [...present].filter(
    name =>
      name === "GHL_API_KEY" ||
      name === "META_CAPI_ACCESS_TOKEN" ||
      name === "STAGE_WEBHOOK_SECRET" ||
      name === "ADMIN_PASSWORD" ||
      name === "ADMIN_SESSION_SECRET",
  );
  const planned = optionalNames.length
    ? planAstroSitePublishFromProfile({
        clientId,
        resolver,
        requiredSecretNames: optionalNames,
      })
    : { ok: true as const, runtimeSecrets: {} as Record<string, string> };
  const runtimeSecrets: Record<string, string> = {
    ...(planned.ok ? planned.runtimeSecrets ?? {} : {}),
    ENVIRONMENT: "preview",
  };
  for (const name of ASTRO_SITE_REQUIRED_RUNTIME_SECRETS) {
    if (!runtimeSecrets[name]?.trim()) runtimeSecrets[name] = previewAdminSecret();
  }

  const validation = validateAstroSitePreview({
    businessName: view.input.identity.businessName,
    shortName: view.input.identity.shortName,
    theme: view.input.brand.theme,
    generatedConfig: view.generatedConfig,
    generatedAt: view.generatedAt,
    config: view.input,
    assets: view.assets,
    metaEnabled: view.input.integrations.meta.enabled,
    metaConfigured: present.has("META_PIXEL_ID"),
  });
  if (validation.blocking.length > 0) {
    const error = new Error(validation.blocking.map(issue => issue.message).join(" "));
    (error as Error & { previewErrorCode?: string }).previewErrorCode =
      validation.blocking.some(issue => issue.code === "generatedConfig")
        ? "CONFIG_VALIDATION_FAILED"
        : "CLIENT_VALIDATION_FAILED";
    throw error;
  }

  return {
    clientShortName: client.shortName,
    snapshot: {
      generatedConfig: view.generatedConfig,
      runtimeSecrets,
      clientRevision: view.websiteRevision,
      warnings: validation.warnings,
    },
  };
}
