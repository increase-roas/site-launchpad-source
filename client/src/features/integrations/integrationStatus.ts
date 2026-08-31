import {
  CLIENT_INTEGRATION_SECRET_KEYS,
  computeClientIntegrationReadiness,
  isIdentifierKey,
  isProfileKey,
  isSecretKey,
  type ClientIntegrationIdentifiers,
  type ClientIntegrationProfileDto,
  type ClientIntegrationProfileKey,
  type ClientIntegrationSecretPresence,
  type SecretPresence,
  type WebsiteIntegrationEnablement,
} from "@shared/clientIntegrationProfile";
import {
  integrationPresenceRows,
  type IntegrationPresenceGroup,
} from "@shared/paidFunnel/integrationPresence";
import { fieldRequirement } from "./integrationGroupMeta";
import type { IntegrationDrafts } from "./useIntegrationDrafts";

export type SectionState = "complete" | "incomplete" | "invalid";

/** The slice of the draft state that readiness depends on. */
export type IntegrationDraftState = Pick<
  IntegrationDrafts,
  "identifiers" | "secrets" | "clearedSecrets" | "rotateStageWebhookSecret"
>;

/**
 * Every status on this page answers "what will be true once I save", so unsaved
 * edits count. Identifiers read from the draft text; secrets fold in queued
 * replacements, rotations, and clears on top of the stored presence.
 */
export function effectiveIdentifiers(
  drafts: IntegrationDraftState,
): ClientIntegrationIdentifiers {
  return {
    GHL_LOCATION_ID: drafts.identifiers.GHL_LOCATION_ID.trim() || null,
    GOOGLE_SHEETS_ID: drafts.identifiers.GOOGLE_SHEETS_ID.trim() || null,
    META_PIXEL_ID: drafts.identifiers.META_PIXEL_ID.trim() || null,
  };
}

export function effectiveSecretPresence(
  dto: ClientIntegrationProfileDto,
  drafts: IntegrationDraftState,
): ClientIntegrationSecretPresence {
  const entries = CLIENT_INTEGRATION_SECRET_KEYS.map(key => {
    if (drafts.clearedSecrets.includes(key)) return [key, "NOT SET" as SecretPresence];
    if (drafts.secrets[key]?.trim()) return [key, "SET" as SecretPresence];
    if (key === "STAGE_WEBHOOK_SECRET" && drafts.rotateStageWebhookSecret) {
      return [key, "SET" as SecretPresence];
    }
    return [key, dto.secretPresence[key]];
  });
  return Object.fromEntries(entries) as ClientIntegrationSecretPresence;
}

export function effectiveReadiness(
  dto: ClientIntegrationProfileDto,
  drafts: IntegrationDraftState,
  enabledIntegrations: WebsiteIntegrationEnablement,
) {
  return computeClientIntegrationReadiness({
    identifiers: effectiveIdentifiers(drafts),
    secretPresence: effectiveSecretPresence(dto, drafts),
    reconciliationStatus: dto.reconciliationStatus,
    enabledIntegrations,
  });
}

export type GroupStatus = {
  state: SectionState;
  missingRequired: ClientIntegrationProfileKey[];
};

export function groupStatus(
  group: IntegrationPresenceGroup,
  dto: ClientIntegrationProfileDto,
  drafts: IntegrationDrafts,
): GroupStatus {
  const presence = effectiveSecretPresence(dto, drafts);
  const required = group.fields.filter(
    field => isProfileKey(field.key) && fieldRequirement(field.key) !== "optional",
  );
  const missingRequired = required
    .filter(field => {
      if (isIdentifierKey(field.key)) return !drafts.identifiers[field.key].trim();
      if (isSecretKey(field.key)) return presence[field.key] !== "SET";
      return false;
    })
    .map(field => field.key as ClientIntegrationProfileKey);
  const hasError = group.fields.some(
    field => isProfileKey(field.key) && drafts.fieldErrors.has(field.key),
  );

  return {
    state: hasError ? "invalid" : missingRequired.length > 0 ? "incomplete" : "complete",
    missingRequired,
  };
}

/**
 * Sections that still need attention open on arrival; finished ones stay shut so
 * the page opens on the work rather than on ten filled-in inputs. Reads saved
 * state only, because it runs before any draft exists.
 */
export function initiallyOpenGroupIds(dto: ClientIntegrationProfileDto): string[] {
  return integrationPresenceRows(dto)
    .filter(group =>
      group.fields.some(
        field =>
          isProfileKey(field.key) &&
          fieldRequirement(field.key) !== "optional" &&
          field.presence !== "SET",
      ),
    )
    .map(group => group.id);
}

/** Which section a field lives in, so a missing-field chip can open the right one. */
export function groupIdForField(
  groups: IntegrationPresenceGroup[],
  fieldKey: string,
): string | undefined {
  return groups.find(group => group.fields.some(field => field.key === fieldKey))?.id;
}
