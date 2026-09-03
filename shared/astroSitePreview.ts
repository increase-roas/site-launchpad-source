import { ASTRO_SITE_APPROVED_SOURCE_SHA } from "./astroSiteContract";
import {
  ASTRO_THEME_VALUES,
  CLIENT_DEPLOY_REQUIRED_ASSETS,
  clientDeployGaps,
  type AstroClientConfigInput,
  type ClientDeployAssetInput,
} from "./astroConfig";

export const astroSitePreviewStepValues = [
  "create_repository",
  "ensure_d1_database",
  "ensure_r2_bucket",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "verify_preview",
  "ready",
] as const;

export type AstroSitePreviewStep = (typeof astroSitePreviewStepValues)[number];

export const astroSitePreviewStatusValues = [
  "pending",
  "running",
  "failed",
  "ready",
] as const;

export type AstroSitePreviewStatus =
  (typeof astroSitePreviewStatusValues)[number];

export const astroSitePreviewErrorCodes = [
  "CLIENT_VALIDATION_FAILED",
  "CONFIG_VALIDATION_FAILED",
  "GITHUB_REPO_CREATE_FAILED",
  "CONFIG_COMMIT_FAILED",
  "D1_PROVISION_FAILED",
  "R2_PROVISION_FAILED",
  "GITHUB_ACTION_FAILED",
  "ASTRO_BUILD_FAILED",
  "CLOUDFLARE_DEPLOY_FAILED",
  "PREVIEW_HEALTHCHECK_FAILED",
  "PREVIEW_ALREADY_RUNNING",
] as const;

export type AstroSitePreviewErrorCode =
  (typeof astroSitePreviewErrorCodes)[number];

export const PREVIEW_ERROR_MESSAGES: Record<AstroSitePreviewErrorCode, string> = {
  CLIENT_VALIDATION_FAILED: "Website configuration is missing required client details.",
  CONFIG_VALIDATION_FAILED: "Website configuration is invalid.",
  GITHUB_REPO_CREATE_FAILED: "The client repository could not be created.",
  CONFIG_COMMIT_FAILED: "Generated website configuration could not be committed.",
  D1_PROVISION_FAILED: "The preview database could not be created.",
  R2_PROVISION_FAILED: "The media bucket could not be created.",
  GITHUB_ACTION_FAILED: "The preview GitHub Action failed.",
  ASTRO_BUILD_FAILED: "Website build failed.",
  CLOUDFLARE_DEPLOY_FAILED: "Preview could not be deployed to Cloudflare.",
  PREVIEW_HEALTHCHECK_FAILED: "The preview URL did not respond successfully.",
  PREVIEW_ALREADY_RUNNING: "A preview is already generating for this client.",
};

const RESOURCE_NAME_MAX_LENGTH = 63;

function resourceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function astroSitePreviewResourceNames(
  clientShortName: string,
  clientId: number,
): {
  externalSiteId: string;
  resourceName: string;
  repositoryName: string;
  workerName: string;
  d1DatabaseName: string;
  r2BucketName: string;
  sessionKvTitle: string;
} {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error("A positive client ID is required for preview.");
  }
  const prefix = "website-";
  const suffix = `-${clientId}`;
  const available =
    RESOURCE_NAME_MAX_LENGTH -
    prefix.length -
    suffix.length -
    "-preview-inventory".length;
  const clientSlug = (resourceSlug(clientShortName) || "client").slice(
    0,
    Math.max(1, available),
  );
  const resourceName = `${prefix}${clientSlug}${suffix}`;
  return {
    externalSiteId: `astro-site-preview-client-${clientId}`,
    resourceName,
    repositoryName: resourceName,
    workerName: `${resourceName}-preview`,
    d1DatabaseName: `${resourceName}-preview-inventory`,
    r2BucketName: `${resourceName}-images`,
    sessionKvTitle: `${resourceName}-preview-session`,
  };
}

export function astroSitePreviewProgress(step: AstroSitePreviewStep): {
  completed: number;
  total: number;
} {
  const total = astroSitePreviewStepValues.length - 1;
  const index = astroSitePreviewStepValues.indexOf(step);
  return { completed: Math.min(Math.max(index, 0), total), total };
}

export function astroSitePreviewStepLabel(step: AstroSitePreviewStep): string {
  switch (step) {
    case "create_repository":
      return "Repository updated";
    case "ensure_d1_database":
      return "Preview database ready";
    case "ensure_r2_bucket":
      return "Media bucket ready";
    case "commit_source":
      return "Website configuration generated";
    case "dispatch_workflow":
      return "Build started";
    case "monitor_workflow":
      return "Building website";
    case "patch_runtime_secrets":
      return "Deploying";
    case "verify_preview":
      return "Verifying";
    case "ready":
      return "Preview ready";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export type PreviewValidationIssue = {
  code: string;
  message: string;
};

export type PreviewValidationResult = {
  blocking: PreviewValidationIssue[];
  warnings: PreviewValidationIssue[];
};

export function parseGeneratedAstroClientConfig(
  generatedConfig: string,
): Record<string, unknown> | null {
  const match = generatedConfig.match(
    /export const rawClientConfig(?::[^=]+)?\s*=\s*(\{[\s\S]*\});?\s*$/,
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function identityName(parsed: Record<string, unknown> | null): string {
  const identity = parsed?.identity;
  if (!identity || typeof identity !== "object") return "";
  const name = (identity as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

export function validateAstroSitePreview(input: {
  businessName: string;
  shortName: string;
  theme: string | null | undefined;
  generatedConfig: string;
  generatedAt: Date | null;
  config: AstroClientConfigInput | null;
  assets: ClientDeployAssetInput;
  metaEnabled?: boolean;
  metaConfigured?: boolean;
}): PreviewValidationResult {
  const blocking: PreviewValidationIssue[] = [];
  const warnings: PreviewValidationIssue[] = [];
  const businessName = input.businessName.trim();
  const shortName = input.shortName.trim();

  if (!businessName) {
    blocking.push({ code: "businessName", message: "Business name is required." });
  }
  if (!shortName) {
    blocking.push({ code: "shortName", message: "Business slug is required." });
  }
  if (!input.theme || !ASTRO_THEME_VALUES.includes(input.theme as (typeof ASTRO_THEME_VALUES)[number])) {
    blocking.push({ code: "theme", message: "A theme preset is required." });
  }
  if (!input.generatedAt || !input.generatedConfig.trim()) {
    blocking.push({
      code: "generatedConfig",
      message: "Save the website configuration before generating a preview.",
    });
  } else {
    const parsed = parseGeneratedAstroClientConfig(input.generatedConfig);
    if (!parsed) {
      blocking.push({
        code: "generatedConfig",
        message: "Generated website configuration is not valid TypeScript JSON.",
      });
    } else if (!identityName(parsed)) {
      blocking.push({
        code: "generatedConfig",
        message: "Generated website configuration is missing the business name.",
      });
    }
  }

  if (input.config) {
    for (const gap of clientDeployGaps(input.config, input.assets)) {
      warnings.push({ code: "clientDeploy", message: gap });
    }
    const urls = Array.isArray(input.assets)
      ? Object.fromEntries(input.assets.map(asset => [asset.slot, asset.storageUrl ?? ""]))
      : input.assets;
    for (const slot of CLIENT_DEPLOY_REQUIRED_ASSETS) {
      const value = urls[slot] ?? "";
      if (!value.startsWith("/") && !value.startsWith("https://")) {
        warnings.push({
          code: slot,
          message: `${slot === "favicon" ? "Favicon" : slot} is not provided.`,
        });
      }
    }
    const gallery = input.config.homepageSections.find(section => section.type === "gallery");
    const galleryImages = gallery?.fields.images?.trim() ?? "";
    if (!galleryImages) {
      warnings.push({ code: "gallery", message: "Gallery has no images." });
    }
    if (input.metaEnabled && !input.metaConfigured) {
      warnings.push({ code: "meta", message: "Meta tracking is not configured." });
    }
  }

  return { blocking, warnings };
}

export function previewIsStale(input: {
  currentRevision: number;
  previewRevision: number | null | undefined;
}): boolean {
  if (input.previewRevision == null) return false;
  return input.currentRevision > input.previewRevision;
}

export function pinnedPreviewTemplateSha(): string {
  return ASTRO_SITE_APPROVED_SOURCE_SHA;
}

export type AstroSitePreviewHistoryItem = {
  id: string;
  status: AstroSitePreviewStatus;
  step: AstroSitePreviewStep;
  clientRevision: number;
  commitSha: string | null;
  templateSha: string;
  previewUrl: string | null;
  error: string | null;
  errorCode: AstroSitePreviewErrorCode | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type AstroSitePreviewStatusView = {
  id: string;
  status: AstroSitePreviewStatus;
  step: AstroSitePreviewStep;
  progress: { completed: number; total: number };
  clientRevision: number;
  currentRevision: number;
  stale: boolean;
  templateSha: string;
  commitSha: string | null;
  previewUrl: string | null;
  repositoryName: string;
  workerName: string;
  repositoryUrl: string | null;
  warnings: PreviewValidationIssue[];
  error: string | null;
  errorCode: AstroSitePreviewErrorCode | null;
  approvedSha: string | null;
  approvedAt: Date | null;
  dispatchRequestedAt: Date | null;
  workflowRunId: string | null;
  workflowStatus: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
