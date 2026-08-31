import { SIMPLE_FORM_TEMPLATE_KEY } from "./simpleFormContract";

// Campaign structures are maintained here, not drawn by operators. A campaign
// picks one and then only supplies content: offer, copy, images, questions.

export const CAMPAIGN_OBJECTIVES = ["leads", "qualified", "appointments"] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_STRUCTURE_KEYS = [
  "lead-capture",
  "qualification",
  "appointment",
] as const;

export type CampaignStructureKey = (typeof CAMPAIGN_STRUCTURE_KEYS)[number];

/** `deferred` structures are defined and visible, but cannot be created yet. */
export type CampaignAvailability = "active" | "deferred";

export type CampaignStructure = {
  key: CampaignStructureKey;
  name: string;
  objective: CampaignObjective;
  summary: string;
  steps: readonly string[];
  /** Template that owns the structure, or null while none is wired up. */
  templateKey: string | null;
  availability: CampaignAvailability;
};

export const CAMPAIGN_STRUCTURES: readonly CampaignStructure[] = [
  {
    key: "lead-capture",
    name: "Lead Capture",
    objective: "leads",
    summary: "Check the ZIP, take the contact details, thank the lead.",
    steps: ["ZIP", "Contact", "Thank You"],
    templateKey: SIMPLE_FORM_TEMPLATE_KEY,
    availability: "active",
  },
  {
    key: "qualification",
    name: "Qualification",
    objective: "qualified",
    summary: "Adds a survey between the ZIP check and the contact step.",
    steps: ["ZIP", "Survey", "Contact", "Thank You"],
    templateKey: null,
    availability: "deferred",
  },
  {
    key: "appointment",
    name: "Appointment",
    objective: "appointments",
    summary: "Adds a booking step so qualified leads pick a time before the thank-you page.",
    steps: ["ZIP", "Survey", "Contact", "Book", "Thank You"],
    templateKey: null,
    availability: "deferred",
  },
];

export function campaignFlowLabel(structure: CampaignStructure): string {
  return structure.steps.join(" → ");
}

export function campaignStructure(key: CampaignStructureKey): CampaignStructure {
  const structure = CAMPAIGN_STRUCTURES.find(candidate => candidate.key === key);
  if (!structure) throw new Error(`Unknown campaign structure: ${key}`);
  return structure;
}

export function campaignStructureForTemplate(
  templateKey: string | null | undefined,
): CampaignStructure | null {
  if (!templateKey) return null;
  return (
    CAMPAIGN_STRUCTURES.find(structure => structure.templateKey === templateKey) ?? null
  );
}

export function activeCampaignStructures(): CampaignStructure[] {
  return CAMPAIGN_STRUCTURES.filter(structure => structure.availability === "active");
}
