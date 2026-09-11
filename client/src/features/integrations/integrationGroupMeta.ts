import {
  FUNNEL_REQUIRED_PROFILE_KEYS,
  OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS,
  WEBSITE_POSSIBLE_PROFILE_KEYS,
  type ClientIntegrationProfileKey,
} from "@shared/clientIntegrationProfile";
import { KeyRound, LineChart, Table2, Webhook, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Presentation-only naming for the groups the server sends. The DTO labels are
 * schema shorthand ("Other shared runtime"); these say what the credentials
 * actually do so an operator can decide whether a section is their problem.
 */
const GROUP_META: Record<string, { name: string; purpose: string; icon: LucideIcon }> = {
  ghl: { name: "GoHighLevel", purpose: "Lead creation and stage callbacks", icon: Workflow },
  sheets: { name: "Google Sheets", purpose: "Spreadsheet copy of each lead", icon: Table2 },
  meta: { name: "Meta", purpose: "Pixel and Conversions API", icon: LineChart },
  callbacks: {
    name: "Callbacks and alerts",
    purpose: "Webhook signing and failure alerts",
    icon: Webhook,
  },
  other: { name: "Website admin access", purpose: "Password for the live site /admin desk", icon: KeyRound },
};

export function groupMeta(id: string, fallbackLabel: string) {
  return (
    GROUP_META[id] ?? { name: fallbackLabel, purpose: "Shared runtime values", icon: KeyRound }
  );
}

/**
 * Only hints that say something the field label does not. Most of
 * WRANGLER_SECRET_DESCRIPTIONS restates the label ("GHL location ID" ->
 * "GoHighLevel client location ID"), which is a wasted line on this page.
 */
export const FIELD_HINTS: Partial<Record<ClientIntegrationProfileKey, string>> = {
  GOOGLE_SHEETS_ID: "Share the sheet with the service account below.",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "Needs Editor access to that sheet.",
  ADMIN_PASSWORD: "Signs in to the preview or live site at /admin.",
};

export type FieldRequirement = "websiteAndFunnels" | "websiteOnly" | "funnelsOnly" | "optional";

const websiteRequired = new Set<string>(WEBSITE_POSSIBLE_PROFILE_KEYS);
const funnelRequired = new Set<string>(FUNNEL_REQUIRED_PROFILE_KEYS);
const optional = new Set<string>(OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS);

export function fieldRequirement(key: string): FieldRequirement {
  if (optional.has(key)) return "optional";
  const website = websiteRequired.has(key);
  const funnels = funnelRequired.has(key);
  if (website && funnels) return "websiteAndFunnels";
  if (funnels) return "funnelsOnly";
  return "websiteOnly";
}

/**
 * Only the narrower scopes are worth surfacing. Most keys feed both surfaces,
 * so labelling those adds a chip to every row and tells the reader nothing.
 */
export const NARROW_REQUIREMENT_LABEL: Partial<Record<FieldRequirement, string>> = {
  websiteOnly: "Website only",
  funnelsOnly: "Funnels only",
};

export function fieldAnchorId(key: string): string {
  return `integration-field-${key}`;
}

export function groupAnchorId(id: string): string {
  return `integration-group-${id}`;
}
