export const CAMPAIGN_TABS = ["setup", "content", "publish"] as const;

export type CampaignTab = (typeof CAMPAIGN_TABS)[number];

export const CAMPAIGN_TAB_LABELS: Record<CampaignTab, string> = {
  setup: "Setup",
  content: "Content",
  publish: "Publish",
};

export const FIRST_CAMPAIGN_TAB: CampaignTab = "setup";

/**
 * Earlier spellings of the steps, kept because saved links and bookmarks still
 * carry them. `lead-form` and `tracking` were separate tabs before their fields
 * moved to setup and their read-only mirror of the client profile was dropped.
 */
const RETIRED_TABS: Record<string, CampaignTab> = {
  overview: "setup",
  "lead-form": "setup",
  tracking: "publish",
};

export function parseCampaignTab(value: string | null | undefined): CampaignTab {
  const match = CAMPAIGN_TABS.find(tab => tab === value);
  if (match) return match;
  return (value ? RETIRED_TABS[value] : undefined) ?? FIRST_CAMPAIGN_TAB;
}

/** `?funnel=` is the pre-Campaign spelling and still arrives from saved links. */
export function parseCampaignSearch(search: string): {
  campaignId: number | null;
  tab: CampaignTab;
} {
  const params = new URLSearchParams(search);
  const requested = params.get("campaign") ?? params.get("funnel");
  const campaignId = requested && /^\d+$/.test(requested) ? Number(requested) : null;
  return { campaignId, tab: parseCampaignTab(params.get("tab")) };
}

export function campaignSearch(campaignId: number, tab: CampaignTab): string {
  return tab === FIRST_CAMPAIGN_TAB
    ? `?campaign=${campaignId}`
    : `?campaign=${campaignId}&tab=${tab}`;
}
