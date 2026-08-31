import type { CampaignTab } from "./campaignTabs";

/**
 * Readiness arrives from the server as one section per subsystem. Each section
 * is filed under whoever can actually clear it: a step in this editor, or the
 * client's integration profile, which a campaign is never allowed to edit.
 * Filing them this way is what stops a step from reporting work it cannot do.
 */

export type CampaignReadinessSection = {
  key: string;
  label: string;
  ready: boolean;
  missing: readonly string[];
};

export type CampaignReadiness = {
  configurationReady: boolean;
  sections: readonly CampaignReadinessSection[];
};

/** Steps that hold editable fields. `publish` reports, it never collects. */
export type CampaignStepKey = Extract<CampaignTab, "setup" | "content">;

export type CampaignSectionOwner = CampaignStepKey | "client-setup";

const SECTION_OWNER: Record<string, CampaignSectionOwner> = {
  client: "setup",
  offer: "setup",
  serviceArea: "setup",
  inventory: "content",
  meta: "client-setup",
  ghl: "client-setup",
  googleSheets: "client-setup",
  offlineConversion: "client-setup",
  productionSecrets: "client-setup",
};

/**
 * Sections the server adds later belong to the client profile until someone
 * gives this editor a field for them, so they surface with a link out rather
 * than pointing at a step that cannot fix them.
 */
export function campaignSectionOwner(key: string): CampaignSectionOwner {
  return SECTION_OWNER[key] ?? "client-setup";
}

export type CampaignStepStatus = {
  /** Absent while readiness is still loading. */
  missingCount: number | null;
  ready: boolean;
};

export type CampaignStepStatuses = Record<CampaignStepKey, CampaignStepStatus>;

const PENDING_STATUS: CampaignStepStatus = { missingCount: null, ready: false };

export function campaignStepStatuses(
  readiness: CampaignReadiness | undefined,
): CampaignStepStatuses {
  if (!readiness) {
    return { setup: PENDING_STATUS, content: PENDING_STATUS };
  }

  const counts: Record<CampaignStepKey, number> = { setup: 0, content: 0 };
  for (const section of readiness.sections) {
    if (section.ready) continue;
    const owner = campaignSectionOwner(section.key);
    if (owner === "client-setup") continue;
    counts[owner] += 1;
  }

  return {
    setup: { missingCount: counts.setup, ready: counts.setup === 0 },
    content: { missingCount: counts.content, ready: counts.content === 0 },
  };
}

/** Only the sections that still block publishing, in server order. */
export function campaignBlockers(
  readiness: CampaignReadiness | undefined,
): CampaignReadinessSection[] {
  return (readiness?.sections ?? []).filter(section => !section.ready);
}

export type CampaignBlocker = {
  section: CampaignReadinessSection;
  step: CampaignStepKey;
};

export type CampaignBlockerGroups = {
  /** Fixable in this editor, each pointing at the step that owns the fields. */
  campaign: CampaignBlocker[];
  /** Fixable only in the client's integration profile. */
  clientSetup: CampaignReadinessSection[];
};

export function campaignBlockerGroups(
  readiness: CampaignReadiness | undefined,
): CampaignBlockerGroups {
  const groups: CampaignBlockerGroups = { campaign: [], clientSetup: [] };
  for (const section of campaignBlockers(readiness)) {
    const owner = campaignSectionOwner(section.key);
    if (owner === "client-setup") groups.clientSetup.push(section);
    else groups.campaign.push({ section, step: owner });
  }
  return groups;
}
