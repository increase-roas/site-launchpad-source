import { eq } from "drizzle-orm";
import {
  clientIntegrationProfiles,
  clientLeadIntegrations,
  clientSecretSetups,
  funnelRuntimeSecrets,
  funnels,
  wranglerSecretSetups,
  type ClientIntegrationProfile,
} from "../drizzle/schema";
import {
  CLIENT_INTEGRATION_SECRET_KEYS,
  FUNNEL_REQUIRED_PROFILE_KEYS,
  WEBSITE_REQUIRED_PROFILE_KEYS,
  buildClientIntegrationProfileDto,
  canonicalizeLegacyKey,
  cloneProfileReference,
  computeClientIntegrationReadiness,
  emptyIdentifiers,
  emptySecretPresence,
  isIdentifierKey,
  isSecretKey,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationIdentifiers,
  type ClientIntegrationProfileDto,
  type ClientIntegrationSecretKey,
  type ClientIntegrationSecretPresence,
  type ClientIntegrationSource,
} from "../shared/clientIntegrationProfile";
import {
  decryptSetupValue,
  encryptSetupValue,
  generateCrmCallbackSecret,
  hasProtectedValue,
} from "./clientSecurity";
import { getDb } from "./db";
import { isUndefinedRelationError } from "../shared/safePublicError";
import { postgresConflictTargets, withUpdatedAt } from "./postgresPersistence";
import type {
  ClientIntegrationProfileResolver,
  PaidFunnelResolvedProfile,
} from "./studio/paidFunnel/profileMapping";

export type ProfileContribution = {
  source: ClientIntegrationSource;
  sourceId: string;
  identifiers: Partial<Record<ClientIntegrationIdentifierKey, string>>;
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>;
};

export type ReconcileResult = {
  status: "ready" | "conflict";
  conflictedKeys: string[];
  identifiers: ClientIntegrationIdentifiers;
  acceptedSecrets: Partial<Record<ClientIntegrationSecretKey, string>>;
};

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("Database is not available.");
    return db;
  });
}

export function encryptSecretBlob(
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>,
): string | null {
  const compact = Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => Boolean(value && value.trim())),
  );
  if (Object.keys(compact).length === 0) return null;
  return encryptSetupValue(JSON.stringify(compact));
}

export function decryptSecretBlob(
  blob: string | null | undefined,
): Partial<Record<ClientIntegrationSecretKey, string>> {
  if (!hasProtectedValue(blob)) return {};
  const parsed = JSON.parse(decryptSetupValue(blob as string)) as Record<string, unknown>;
  const secrets: Partial<Record<ClientIntegrationSecretKey, string>> = {};
  for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) secrets[key] = value;
  }
  return secrets;
}

export function secretPresenceFromBlob(
  blob: string | null | undefined,
): ClientIntegrationSecretPresence {
  const secrets = decryptSecretBlob(blob);
  const presence = emptySecretPresence();
  for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
    presence[key] = secrets[key] ? "SET" : "NOT SET";
  }
  return presence;
}

export function identifiersFromRow(
  row: Pick<ClientIntegrationProfile, "ghlLocationId" | "googleSheetsId" | "metaPixelId"> | undefined,
): ClientIntegrationIdentifiers {
  return {
    GHL_LOCATION_ID: row?.ghlLocationId ?? null,
    GOOGLE_SHEETS_ID: row?.googleSheetsId ?? null,
    META_PIXEL_ID: row?.metaPixelId ?? null,
  };
}

export function toProfileDto(row: ClientIntegrationProfile | undefined, clientId: number): ClientIntegrationProfileDto {
  return buildClientIntegrationProfileDto({
    clientId,
    identifiers: identifiersFromRow(row),
    secretPresence: secretPresenceFromBlob(row?.secretsEncrypted),
    lastUpdated: row?.updatedAt ?? null,
    reconciliationStatus: row?.reconciliationStatus ?? "pending",
    conflictedKeys: row?.conflictedKeys ?? [],
  });
}

export function reconcileContributions(contributions: ProfileContribution[]): ReconcileResult {
  const identifiers = emptyIdentifiers();
  const acceptedSecrets: Partial<Record<ClientIntegrationSecretKey, string>> = {};
  const conflicted = new Set<string>();
  const seenIdentifiers = new Map<ClientIntegrationIdentifierKey, string>();
  const seenSecrets = new Map<ClientIntegrationSecretKey, string>();

  for (const contribution of contributions) {
    for (const [key, value] of Object.entries(contribution.identifiers)) {
      if (!isIdentifierKey(key) || !value?.trim()) continue;
      const previous = seenIdentifiers.get(key);
      if (previous && previous !== value) {
        conflicted.add(key);
        continue;
      }
      seenIdentifiers.set(key, value);
    }
    for (const [key, value] of Object.entries(contribution.secrets)) {
      if (!isSecretKey(key) || !value?.trim()) continue;
      const previous = seenSecrets.get(key);
      if (previous && previous !== value) {
        conflicted.add(key);
        continue;
      }
      seenSecrets.set(key, value);
    }
  }

  for (const [key, value] of seenIdentifiers) {
    if (!conflicted.has(key)) identifiers[key] = value;
  }
  for (const [key, value] of seenSecrets) {
    if (!conflicted.has(key)) acceptedSecrets[key] = value;
  }

  return {
    status: conflicted.size > 0 ? "conflict" : "ready",
    conflictedKeys: [...conflicted].sort(),
    identifiers,
    acceptedSecrets,
  };
}

function decodeMaybeEncrypted(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (hasProtectedValue(value)) {
    try {
      return decryptSetupValue(value);
    } catch {
      return null;
    }
  }
  return value.trim();
}

function stringRecord(row: object | null | undefined): Record<string, string | null | undefined> | null {
  if (!row) return null;
  const out: Record<string, string | null | undefined> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" || value == null) out[key] = value ?? null;
  }
  return out;
}

export function contributionsFromLegacyRows(input: {
  clientId: number;
  lead?: object | null;
  wrangler?: object | null;
  clientSecrets?: object | null;
  funnelSecrets?: Array<{ funnelId: number; row: object }>;
}): ProfileContribution[] {
  const contributions: ProfileContribution[] = [];

  const lead = stringRecord(input.lead);
  const wrangler = stringRecord(input.wrangler);
  const clientSecrets = stringRecord(input.clientSecrets);

  if (lead) {
    contributions.push({
      source: "clientLeadIntegrations",
      sourceId: String(input.clientId),
      identifiers: {
        GHL_LOCATION_ID: decodeMaybeEncrypted(lead.ghlLocationId) ?? undefined,
        GOOGLE_SHEETS_ID: decodeMaybeEncrypted(lead.googleSheetsId) ?? undefined,
        META_PIXEL_ID: decodeMaybeEncrypted(lead.metaPixelId) ?? undefined,
      },
      secrets: {
        GHL_API_KEY: decodeMaybeEncrypted(lead.ghlApiKeyEncrypted) ?? undefined,
        META_CAPI_ACCESS_TOKEN: decodeMaybeEncrypted(lead.metaCapiAccessTokenEncrypted) ?? undefined,
        STAGE_WEBHOOK_SECRET: decodeMaybeEncrypted(lead.stageWebhookSecretEncrypted) ?? undefined,
        ALERT_WEBHOOK_URL: decodeMaybeEncrypted(lead.alertWebhookUrlEncrypted) ?? undefined,
      },
    });
  }

  if (wrangler) {
    contributions.push({
      source: "wranglerSecretSetups",
      sourceId: String(input.clientId),
      identifiers: {
        GHL_LOCATION_ID: decodeMaybeEncrypted(wrangler.ghlLocationIdEncrypted) ?? undefined,
        GOOGLE_SHEETS_ID: decodeMaybeEncrypted(wrangler.googleSheetsIdEncrypted) ?? undefined,
        META_PIXEL_ID: decodeMaybeEncrypted(wrangler.metaPixelIdEncrypted) ?? undefined,
      },
      secrets: {
        GHL_API_KEY: decodeMaybeEncrypted(wrangler.ghlApiKeyEncrypted) ?? undefined,
        META_CAPI_ACCESS_TOKEN: decodeMaybeEncrypted(wrangler.metaCapiAccessTokenEncrypted) ?? undefined,
        STAGE_WEBHOOK_SECRET: decodeMaybeEncrypted(wrangler.stageWebhookSecretEncrypted) ?? undefined,
        GOOGLE_SERVICE_ACCOUNT_EMAIL:
          decodeMaybeEncrypted(wrangler.googleServiceAccountEmailEncrypted) ?? undefined,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
          decodeMaybeEncrypted(wrangler.googleServiceAccountPrivateKeyEncrypted) ?? undefined,
        ALERT_WEBHOOK_URL: decodeMaybeEncrypted(wrangler.alertWebhookUrlEncrypted) ?? undefined,
        ADMIN_PASSWORD: decodeMaybeEncrypted(wrangler.adminPasswordEncrypted) ?? undefined,
        ADMIN_SESSION_SECRET: decodeMaybeEncrypted(wrangler.adminSessionSecretEncrypted) ?? undefined,
        META_VALUE_QUALIFIED: decodeMaybeEncrypted(wrangler.metaValueQualifiedEncrypted) ?? undefined,
        META_VALUE_SCHEDULE: decodeMaybeEncrypted(wrangler.metaValueScheduleEncrypted) ?? undefined,
        META_VALUE_SHOWED: decodeMaybeEncrypted(wrangler.metaValueShowedEncrypted) ?? undefined,
      },
    });
  }

  if (clientSecrets) {
    const ghlApiKey = decodeMaybeEncrypted(clientSecrets.ghlApiKeyEncrypted);
    const legacyWebhook = decodeMaybeEncrypted(clientSecrets.ghlWebhookUrlEncrypted);
    contributions.push({
      source: "clientSecretSetups",
      sourceId: String(input.clientId),
      identifiers: {
        META_PIXEL_ID: decodeMaybeEncrypted(clientSecrets.metaPixelIdEncrypted) ?? undefined,
      },
      secrets: {
        GHL_API_KEY: ghlApiKey ?? legacyWebhook ?? undefined,
      },
    });
    if (ghlApiKey && legacyWebhook && ghlApiKey !== legacyWebhook) {
      contributions.push({
        source: "clientSecretSetups",
        sourceId: `${input.clientId}:legacy-ghl-webhook`,
        identifiers: {},
        secrets: { GHL_API_KEY: legacyWebhook },
      });
    }
  }

  for (const item of input.funnelSecrets ?? []) {
    const mapped: Partial<Record<ClientIntegrationSecretKey, string>> = {};
    const secretRow = stringRecord(item.row) ?? {};
    const ghl = decodeMaybeEncrypted(secretRow.ghlWebhookUrlEncrypted);
    const callback = decodeMaybeEncrypted(secretRow.crmCallbackSecretEncrypted);
    const capi = decodeMaybeEncrypted(secretRow.metaCapiAccessTokenEncrypted);
    const alert = decodeMaybeEncrypted(secretRow.submissionAlertWebhookUrlEncrypted);
    if (ghl) mapped[canonicalizeLegacyKey("GHL_WEBHOOK_URL") as ClientIntegrationSecretKey] = ghl;
    if (callback) mapped[canonicalizeLegacyKey("CRM_CALLBACK_SECRET") as ClientIntegrationSecretKey] = callback;
    if (capi) mapped.META_CAPI_ACCESS_TOKEN = capi;
    if (alert) mapped.ALERT_WEBHOOK_URL = alert;
    contributions.push({
      source: "funnelRuntimeSecrets",
      sourceId: String(item.funnelId),
      identifiers: {},
      secrets: mapped,
    });
  }

  return contributions;
}

export function readinessForSurfaces(dto: ClientIntegrationProfileDto) {
  const website = computeClientIntegrationReadiness({
    identifiers: dto.identifiers,
    secretPresence: dto.secretPresence,
    reconciliationStatus: dto.reconciliationStatus,
  });
  const funnel = computeClientIntegrationReadiness({
    identifiers: dto.identifiers,
    secretPresence: dto.secretPresence,
    reconciliationStatus: dto.reconciliationStatus,
  });
  return {
    websiteReady: website.websiteReady,
    funnelAReady: funnel.funnelReady,
    funnelBReady: funnel.funnelReady,
    requiredWebsite: WEBSITE_REQUIRED_PROFILE_KEYS,
    requiredFunnel: FUNNEL_REQUIRED_PROFILE_KEYS,
  };
}

export function cloneClientIntegrationProfile(input: {
  source: ClientIntegrationProfile | undefined;
  sourceClientId: number;
  targetClientId: number;
  sameCustomer: boolean;
}): { clientId: number; copiesSecrets: false; dto: ClientIntegrationProfileDto } {
  const reference = cloneProfileReference(input);
  if (input.sameCustomer) {
    return {
      clientId: reference.clientId,
      copiesSecrets: false,
      dto: toProfileDto(input.source, input.sourceClientId),
    };
  }
  return {
    clientId: input.targetClientId,
    copiesSecrets: false,
    dto: toProfileDto(undefined, input.targetClientId),
  };
}

export async function getClientIntegrationProfile(clientId: number): Promise<ClientIntegrationProfileDto> {
  try {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(clientIntegrationProfiles)
      .where(eq(clientIntegrationProfiles.clientId, clientId))
      .limit(1);
    return toProfileDto(rows[0], clientId);
  } catch (error) {
    if (isUndefinedRelationError(error)) {
      return toProfileDto(undefined, clientId);
    }
    throw error;
  }
}

export async function saveClientIntegrationProfile(
  clientId: number,
  input: {
    identifiers?: Partial<ClientIntegrationIdentifiers>;
    replaceSecrets?: Partial<Record<ClientIntegrationSecretKey, string>>;
    clearSecrets?: ClientIntegrationSecretKey[];
    rotateStageWebhookSecret?: boolean;
  },
): Promise<ClientIntegrationProfileDto> {
  const db = await requireDb();
  const existing = (
    await db
      .select()
      .from(clientIntegrationProfiles)
      .where(eq(clientIntegrationProfiles.clientId, clientId))
      .limit(1)
  )[0];
  const identifiers = identifiersFromRow(existing);
  if (input.identifiers) {
    for (const key of ["GHL_LOCATION_ID", "GOOGLE_SHEETS_ID", "META_PIXEL_ID"] as const) {
      if (input.identifiers[key] !== undefined) identifiers[key] = input.identifiers[key];
    }
  }
  const secrets = decryptSecretBlob(existing?.secretsEncrypted);
  for (const [key, value] of Object.entries(input.replaceSecrets ?? {})) {
    if (isSecretKey(key) && value?.trim()) secrets[key] = value.trim();
  }
  for (const key of input.clearSecrets ?? []) delete secrets[key];
  if (input.rotateStageWebhookSecret) {
    secrets.STAGE_WEBHOOK_SECRET = generateCrmCallbackSecret();
  }
  const row = {
    clientId,
    profileVersion: existing?.profileVersion ?? 1,
    ghlLocationId: identifiers.GHL_LOCATION_ID,
    googleSheetsId: identifiers.GOOGLE_SHEETS_ID,
    metaPixelId: identifiers.META_PIXEL_ID,
    secretsEncrypted: encryptSecretBlob(secrets),
    reconciliationStatus: existing?.reconciliationStatus === "conflict" ? ("conflict" as const) : ("ready" as const),
    conflictedKeys: existing?.conflictedKeys ?? [],
  };
  await db
    .insert(clientIntegrationProfiles)
    .values(row)
    .onConflictDoUpdate({
      target: postgresConflictTargets.clientIntegrationProfiles,
      set: withUpdatedAt(row),
    });
  return getClientIntegrationProfile(clientId);
}

export async function reconcileClientIntegrationProfile(clientId: number): Promise<ClientIntegrationProfileDto> {
  const db = await requireDb();
  const [lead, wrangler, clientSecrets, funnelRows] = await Promise.all([
    db.select().from(clientLeadIntegrations).where(eq(clientLeadIntegrations.clientId, clientId)).limit(1),
    db.select().from(wranglerSecretSetups).where(eq(wranglerSecretSetups.clientId, clientId)).limit(1),
    db.select().from(clientSecretSetups).where(eq(clientSecretSetups.clientId, clientId)).limit(1),
    db
      .select({ funnelId: funnels.id, secrets: funnelRuntimeSecrets })
      .from(funnels)
      .leftJoin(funnelRuntimeSecrets, eq(funnelRuntimeSecrets.funnelId, funnels.id))
      .where(eq(funnels.clientId, clientId)),
  ]);
  const contributions = contributionsFromLegacyRows({
    clientId,
    lead: lead[0] ?? null,
    wrangler: wrangler[0] ?? null,
    clientSecrets: clientSecrets[0] ?? null,
    funnelSecrets: funnelRows
      .filter(row => row.secrets)
      .map(row => ({ funnelId: row.funnelId, row: row.secrets as object })),
  });
  const reconciled = reconcileContributions(contributions);
  const row = {
    clientId,
    profileVersion: 1,
    ghlLocationId: reconciled.identifiers.GHL_LOCATION_ID,
    googleSheetsId: reconciled.identifiers.GOOGLE_SHEETS_ID,
    metaPixelId: reconciled.identifiers.META_PIXEL_ID,
    secretsEncrypted: encryptSecretBlob(reconciled.acceptedSecrets),
    reconciliationStatus: reconciled.status,
    conflictedKeys: reconciled.conflictedKeys,
  };
  await db
    .insert(clientIntegrationProfiles)
    .values(row)
    .onConflictDoUpdate({
      target: postgresConflictTargets.clientIntegrationProfiles,
      set: withUpdatedAt(row),
    });
  return getClientIntegrationProfile(clientId);
}

export function resolvePublisherMappings(blob: string | null | undefined) {
  return decryptSecretBlob(blob);
}

export async function loadResolvedPaidFunnelProfile(
  clientId: number,
): Promise<PaidFunnelResolvedProfile | null> {
  try {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(clientIntegrationProfiles)
      .where(eq(clientIntegrationProfiles.clientId, clientId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      clientId,
      dto: toProfileDto(row, clientId),
      secrets: decryptSecretBlob(row.secretsEncrypted),
    };
  } catch (error) {
    if (isUndefinedRelationError(error)) return null;
    throw error;
  }
}

export function createClientIntegrationProfileResolver(
  profiles: readonly PaidFunnelResolvedProfile[],
): ClientIntegrationProfileResolver {
  const byId = new Map(profiles.map(profile => [profile.clientId, profile]));
  return {
    resolveByClientId(id) {
      return byId.get(id) ?? null;
    },
  };
}

export async function clientIntegrationProfileResolverForClient(
  clientId: number,
): Promise<ClientIntegrationProfileResolver> {
  const profile = await loadResolvedPaidFunnelProfile(clientId);
  return createClientIntegrationProfileResolver(profile ? [profile] : []);
}
