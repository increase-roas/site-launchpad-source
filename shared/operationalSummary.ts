import {
  ASSET_SLOT_VALUES,
  THEME_VALUES,
  businessInformationSchema,
  type AssetSlot,
  type ClientInput,
  type ThemeValue,
} from "./client";
import {
  OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS,
  WEBSITE_REQUIRED_PROFILE_KEYS,
} from "./clientIntegrationProfile";
import {
  WRANGLER_SECRET_VALUES,
  type WranglerSecretName,
} from "./astroConfig";

export const OPERATIONAL_SUMMARY_KEYS = [
  "businessInformation",
  "websiteSetup",
  "websiteIntegrations",
  "websiteLive",
  "funnelIntegrations",
  "funnelsLive",
] as const;
export type OperationalSummaryKey = (typeof OPERATIONAL_SUMMARY_KEYS)[number];

export const OPERATIONAL_STATUS_VALUES = [
  "setup_needed",
  "ready_to_publish",
  "publishing",
  "live",
  "issue",
] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUS_VALUES)[number];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  setup_needed: "Setup needed",
  ready_to_publish: "Ready to publish",
  publishing: "Publishing",
  live: "Live",
  issue: "Issue",
};

export const OPERATIONAL_SUMMARY_LABELS: Record<OperationalSummaryKey, string> = {
  businessInformation: "Business information",
  websiteSetup: "Website setup",
  websiteIntegrations: "Website integrations",
  websiteLive: "Website live",
  funnelIntegrations: "Funnel integrations",
  funnelsLive: "Funnels live",
};

export type PublishJobSnapshot = {
  status: string;
  liveUrl?: string | null;
};

export type OperationalSummaryItem = {
  key: OperationalSummaryKey;
  label: string;
  complete: boolean;
};

export type RuntimeConfigurationSummary = {
  set: number;
  total: number;
  label: string;
  requiredMissing: string[];
  optionalUnset: string[];
  blocksLaunch: boolean;
};

export type OperationalSummary = {
  items: OperationalSummaryItem[];
  status: OperationalStatus;
  statusLabel: string;
  liveUrl: string | null;
  runtimeConfiguration: RuntimeConfigurationSummary;
};

export function isCompletedPublishJob(
  job: PublishJobSnapshot | null | undefined
): boolean {
  return job?.status === "published" && Boolean(job.liveUrl?.trim());
}

export function isActivePublishJob(
  job: PublishJobSnapshot | null | undefined
): boolean {
  return job?.status === "pending" || job?.status === "running";
}

export function isFailedPublishJob(
  job: PublishJobSnapshot | null | undefined
): boolean {
  return job?.status === "failed";
}

export function summarizeRuntimeConfiguration(
  secretStatus: Partial<Record<WranglerSecretName, boolean>>
): RuntimeConfigurationSummary {
  const total = WRANGLER_SECRET_VALUES.length;
  const set = WRANGLER_SECRET_VALUES.filter(name => secretStatus[name]).length;
  const optional = new Set<string>(OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS);
  const requiredMissing = WEBSITE_REQUIRED_PROFILE_KEYS.filter(
    name => !secretStatus[name as WranglerSecretName]
  );
  const optionalUnset = WRANGLER_SECRET_VALUES.filter(
    name => optional.has(name) && !secretStatus[name]
  );
  return {
    set,
    total,
    label: `Runtime configuration — ${set} of ${total} set`,
    requiredMissing: [...requiredMissing],
    optionalUnset,
    blocksLaunch: requiredMissing.length > 0,
  };
}

function hasRequiredWebsitePhotos(presentAssetSlots: Iterable<AssetSlot>): boolean {
  const present = new Set(presentAssetSlots);
  return ASSET_SLOT_VALUES.every(slot => present.has(slot));
}

function firstLiveUrl(jobs: Array<PublishJobSnapshot | null | undefined>): string | null {
  for (const job of jobs) {
    if (isCompletedPublishJob(job) && job?.liveUrl?.trim()) return job.liveUrl.trim();
  }
  return null;
}

export function buildOperationalSummary(input: {
  client: Partial<ClientInput>;
  presentAssetSlots: Iterable<AssetSlot>;
  websiteIntegrationsReady: boolean;
  funnelIntegrationsReady: boolean;
  websitePublish: PublishJobSnapshot | null;
  funnelPublishes: PublishJobSnapshot[];
  secretStatus?: Partial<Record<WranglerSecretName, boolean>>;
}): OperationalSummary {
  const businessInformation = businessInformationSchema.safeParse(input.client).success;
  const websiteSetup =
    THEME_VALUES.includes(input.client.theme as ThemeValue) &&
    hasRequiredWebsitePhotos(input.presentAssetSlots);
  const websiteLive = isCompletedPublishJob(input.websitePublish);
  const funnelsLive =
    input.funnelPublishes.length > 0 &&
    input.funnelPublishes.some(job => isCompletedPublishJob(job));
  const items: OperationalSummaryItem[] = OPERATIONAL_SUMMARY_KEYS.map(key => {
    const complete =
      key === "businessInformation"
        ? businessInformation
        : key === "websiteSetup"
          ? websiteSetup
          : key === "websiteIntegrations"
            ? input.websiteIntegrationsReady
            : key === "websiteLive"
              ? websiteLive
              : key === "funnelIntegrations"
                ? input.funnelIntegrationsReady
                : funnelsLive;
    return { key, label: OPERATIONAL_SUMMARY_LABELS[key], complete };
  });

  const jobs = [input.websitePublish, ...input.funnelPublishes];
  const liveUrl = firstLiveUrl(jobs);
  let status: OperationalStatus = "setup_needed";
  if (jobs.some(job => isFailedPublishJob(job))) status = "issue";
  else if (jobs.some(job => isActivePublishJob(job))) status = "publishing";
  else if (websiteLive) status = "live";
  else if (businessInformation && websiteSetup && input.websiteIntegrationsReady) {
    status = "ready_to_publish";
  }

  return {
    items,
    status,
    statusLabel: OPERATIONAL_STATUS_LABELS[status],
    liveUrl,
    runtimeConfiguration: summarizeRuntimeConfiguration(input.secretStatus ?? {}),
  };
}

export function integrationPresenceTone(
  key: string,
  presence: "SET" | "NOT SET"
): "set" | "missing" | "optional" {
  if (presence === "SET") return "set";
  if ((OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS as readonly string[]).includes(key)) {
    return "optional";
  }
  return "missing";
}
