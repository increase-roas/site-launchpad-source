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
import { postgresConflictTargets, withUpdatedAt } from "./postgresPersistence";

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

export function contributionsFromLegacyRows(input: {
  clientId: number;
  lead?: Record<string, string | null | undefined> | null;
  wrangler?: Record<string, string | null | undefined> | null;
  clientSecrets?: Record<string, string | null | undefined> | null;
  funnelSecrets?: Array<{ funnelId: number; row: Record<string, string | null | undefined> }>;
}): ProfileContribution[] {
  const contributions: ProfileContribution[] = [];

  if (input.lead) {
    contributions.push({
      source: "clientLeadIntegrations",
      sourceId: String(input.clientId),
      identifiers: {
        GHL_LOCATION_ID: decodeMaybeEncrypted(input.lead.ghlLocationId) ?? undefined,
        GOOGLE_SHEETS_ID: decodeMaybeEncrypted(input.lead.googleSheetsId) ?? undefined,
        META_PIXEL_ID: decodeMaybeEncrypted(input.lead.metaPixelId) ?? undefined,
      },
      secrets: {
        GHL_API_KEY: decodeMaybeEncrypted(input.lead.ghlApiKeyEncrypted) ?? undefined,
        META_CAPI_ACCESS_TOKEN: decodeMaybeEncrypted(input.lead.metaCapiAccessTokenEncrypted) ?? undefined,
        STAGE_WEBHOOK_SECRET: decodeMaybeEncrypted(input.lead.stageWebhookSecretEncrypted) ?? undefined,
        ALERT_WEBHOOK_URL: decodeMaybeEncrypted(input.lead.alertWebhookUrlEncrypted) ?? undefined,
      },
    });
  }

  if (input.wrangler) {
    contributions.push({
      source: "wranglerSecretSetups",
      sourceId: String(input.clientId),
      identifiers: {
        GHL_LOCATION_ID: decodeMaybeEncrypted(input.wrangler.ghlLocationIdEncrypted) ?? undefined,
        GOOGLE_SHEETS_ID: decodeMaybeEncrypted(input.wrangler.googleSheetsIdEncrypted) ?? undefined,
        META_PIXEL_ID: decodeMaybeEncrypted(input.wrangler.metaPixelIdEncrypted) ?? undefined,
      },
      secrets: {
        GHL_API_KEY: decodeMaybeEncrypted(input.wrangler.ghlApiKeyEncrypted) ?? undefined,
        META_CAPI_ACCESS_TOKEN: decodeMaybeEncrypted(input.wrangler.metaCapiAccessTokenEncrypted) ?? undefined,
        STAGE_WEBHOOK_SECRET: decodeMaybeEncrypted(input.wrangler.stageWebhookSecretEncrypted) ?? undefined,
        GOOGLE_SERVICE_ACCOUNT_EMAIL:
          decodeMaybeEncrypted(input.wrangler.googleServiceAccountEmailEncrypted) ?? undefined,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
          decodeMaybeEncrypted(input.wrangler.googleServiceAccountPrivateKeyEncrypted) ?? undefined,
        ALERT_WEBHOOK_URL: decodeMaybeEncrypted(input.wrangler.alertWebhookUrlEncrypted) ?? undefined,
        ADMIN_PASSWORD: decodeMaybeEncrypted(input.wrangler.adminPasswordEncrypted) ?? undefined,
        ADMIN_SESSION_SECRET: decodeMaybeEncrypted(input.wrangler.adminSessionSecretEncrypted) ?? undefined,
        META_VALUE_QUALIFIED: decodeMaybeEncrypted(input.wrangler.metaValueQualifiedEncrypted) ?? undefined,
        META_VALUE_SCHEDULE: decodeMaybeEncrypted(input.wrangler.metaValueScheduleEncrypted) ?? undefined,
        META_VALUE_SHOWED: decodeMaybeEncrypted(input.wrangler.metaValueShowedEncrypted) ?? undefined,
      },
    });
  }

  if (input.clientSecrets) {
    const ghlApiKey = decodeMaybeEncrypted(input.clientSecrets.ghlApiKeyEncrypted);
    const legacyWebhook = decodeMaybeEncrypted(input.clientSecrets.ghlWebhookUrlEncrypted);
    contributions.push({
      source: "clientSecretSetups",
      sourceId: String(input.clientId),
      identifiers: {
        META_PIXEL_ID: decodeMaybeEncrypted(input.clientSecrets.metaPixelIdEncrypted) ?? undefined,
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
    const ghl = decodeMaybeEncrypted(item.row.ghlWebhookUrlEncrypted);
    const callback = decodeMaybeEncrypted(item.row.crmCallbackSecretEncrypted);
    const capi = decodeMaybeEncrypted(item.row.metaCapiAccessTokenEncrypted);
    const alert = decodeMaybeEncrypted(item.row.submissionAlertWebhookUrlEncrypted);
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
  const db = await requireDb();
  const rows = await db
    .select()
    .from(clientIntegrationProfiles)
    .where(eq(clientIntegrationProfiles.clientId, clientId))
    .limit(1);
  return toProfileDto(rows[0], clientId);
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
    reconciliationStatus: existing?.reconciliationStatus === "conflict" ? "conflict" : "ready",
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
      .map(row => ({ funnelId: row.funnelId, row: row.secrets as Record<string, string | null> })),
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
