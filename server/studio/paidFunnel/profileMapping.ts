import {
  CLIENT_INTEGRATION_SECRET_KEYS,
  FUNNEL_REQUIRED_PROFILE_KEYS,
  buildClientIntegrationProfileDto,
  cloneProfileReference,
  emptyIdentifiers,
  emptySecretPresence,
  isIdentifierKey,
  isSecretKey,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationIdentifiers,
  type ClientIntegrationProfileDto,
  type ClientIntegrationSecretKey,
  type ClientIntegrationSecretPresence,
} from "../../../shared/clientIntegrationProfile";
import {
  decryptSetupValue,
  encryptSetupValue,
  hasProtectedValue,
} from "../../clientSecurity";

export const PAID_FUNNEL_LIVE_SYNC_ACTIONS = [
  "republish",
  "sync-integrations",
] as const;
export type PaidFunnelLiveSyncAction =
  (typeof PAID_FUNNEL_LIVE_SYNC_ACTIONS)[number];

export const PAID_FUNNEL_PUBLISH_ACTIONS = [
  "publish",
  ...PAID_FUNNEL_LIVE_SYNC_ACTIONS,
] as const;
export type PaidFunnelPublishAction =
  (typeof PAID_FUNNEL_PUBLISH_ACTIONS)[number];

export type PaidFunnelResolvedProfile = {
  clientId: number;
  dto: ClientIntegrationProfileDto;
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>;
};

export type PaidFunnelAdapterBindings = {
  clientId: number;
  env: Partial<Record<ClientIntegrationIdentifierKey, string>>;
  secrets: Partial<Record<string, string>>;
  bindingNames: string[];
};

export type ClientIntegrationProfileResolver = {
  resolveByClientId(clientId: number): PaidFunnelResolvedProfile | null;
};

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export type PaidFunnelRuntimeSecretContract = {
  requiredRuntimeSecrets: readonly string[];
  offlineConversionContract?: {
    requiredRuntimeSecrets: readonly string[];
  };
};

export function requiredPaidFunnelSecretNames(
  pkg: PaidFunnelRuntimeSecretContract
): string[] {
  return unique([
    ...pkg.requiredRuntimeSecrets,
    ...(pkg.offlineConversionContract?.requiredRuntimeSecrets ?? []),
    ...FUNNEL_REQUIRED_PROFILE_KEYS,
  ]);
}

export function encryptSecretBlob(
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>
): string | null {
  const compact = Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => Boolean(value && value.trim()))
  );
  if (Object.keys(compact).length === 0) return null;
  return encryptSetupValue(JSON.stringify(compact));
}

export function decryptSecretBlob(
  blob: string | null | undefined
): Partial<Record<ClientIntegrationSecretKey, string>> {
  if (!hasProtectedValue(blob)) return {};
  const parsed = JSON.parse(decryptSetupValue(blob as string)) as Record<
    string,
    unknown
  >;
  const secrets: Partial<Record<ClientIntegrationSecretKey, string>> = {};
  for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) secrets[key] = value;
  }
  return secrets;
}

export function resolvePublisherMappings(
  blob: string | null | undefined
): Partial<Record<ClientIntegrationSecretKey, string>> {
  return decryptSecretBlob(blob);
}

export function resolvePaidFunnelProfileByClientId(
  clientId: number,
  resolver: ClientIntegrationProfileResolver
):
  | { ok: true; profile: PaidFunnelResolvedProfile }
  | { ok: false; error: string } {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return { ok: false, error: "A positive clientId is required." };
  }
  const profile = resolver.resolveByClientId(clientId);
  if (!profile) {
    return { ok: false, error: "Client integration profile is not SET." };
  }
  if (profile.clientId !== clientId || profile.dto.clientId !== clientId) {
    return { ok: false, error: "Client integration profile clientId mismatch." };
  }
  return { ok: true, profile };
}

export function mapProfileToGenericPaidFunnelBindings(input: {
  clientId: number;
  identifiers: ClientIntegrationIdentifiers;
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>;
  requiredNames: readonly string[];
}): PaidFunnelAdapterBindings {
  const env: Partial<Record<ClientIntegrationIdentifierKey, string>> = {};
  const secrets: Partial<Record<string, string>> = {};
  const bindingNames: string[] = [];

  for (const name of unique(input.requiredNames)) {
    if (isIdentifierKey(name)) {
      const value = input.identifiers[name]?.trim();
      if (!value) continue;
      env[name] = value;
      secrets[name] = value;
      bindingNames.push(name);
      continue;
    }
    if (isSecretKey(name)) {
      const value = input.secrets[name]?.trim();
      if (!value) continue;
      secrets[name] = value;
      bindingNames.push(name);
    }
  }

  return {
    clientId: input.clientId,
    env,
    secrets,
    bindingNames,
  };
}

export function authorizePaidFunnelLiveRewrite(input: {
  hasLiveDeploy: boolean;
  action?: PaidFunnelPublishAction;
}):
  | { ok: true; action: PaidFunnelPublishAction }
  | { ok: false; error: string } {
  const action = input.action ?? "publish";
  if (!input.hasLiveDeploy) {
    return { ok: true, action: "publish" };
  }
  if (
    action === "republish" ||
    action === "sync-integrations"
  ) {
    return { ok: true, action };
  }
  return {
    ok: false,
    error:
      "Existing live deploys require explicit Republish or Sync Integrations.",
  };
}

export function clonePaidFunnelClientProfile(input: {
  sourceClientId: number;
  targetClientId: number;
  sameCustomer: boolean;
  sourceProfile: ClientIntegrationProfileDto;
}): {
  clientId: number;
  copiesSecrets: false;
  profile: ClientIntegrationProfileDto;
} {
  const reference = cloneProfileReference({
    sourceClientId: input.sourceClientId,
    targetClientId: input.targetClientId,
    sameCustomer: input.sameCustomer,
  });
  if (input.sameCustomer) {
    return {
      clientId: reference.clientId,
      copiesSecrets: false,
      profile: input.sourceProfile,
    };
  }
  return {
    clientId: input.targetClientId,
    copiesSecrets: false,
    profile: buildClientIntegrationProfileDto({
      clientId: input.targetClientId,
      identifiers: emptyIdentifiers(),
      secretPresence: emptySecretPresence(),
      lastUpdated: null,
      reconciliationStatus: "pending",
      conflictedKeys: [],
    }),
  };
}

export function buildReadyPaidFunnelProfileDto(
  clientId = 5
): ClientIntegrationProfileDto {
  const secretPresence: ClientIntegrationSecretPresence = emptySecretPresence();
  for (const key of Object.keys(secretPresence) as Array<keyof ClientIntegrationSecretPresence>) {
    secretPresence[key] = "SET";
  }
  return buildClientIntegrationProfileDto({
    clientId,
    identifiers: {
      GHL_LOCATION_ID: "location-123",
      GOOGLE_SHEETS_ID: "sheet-123",
      META_PIXEL_ID: "123456789012345",
    },
    secretPresence,
    lastUpdated: new Date("2026-08-18T06:00:00.000Z"),
    reconciliationStatus: "ready",
    conflictedKeys: [],
  });
}

export function buildReadyPaidFunnelSecrets(): Partial<
  Record<ClientIntegrationSecretKey, string>
> {
  return {
    GHL_API_KEY: "ghl-live-api-key-AAA",
    META_CAPI_ACCESS_TOKEN: "meta-capi-token-BBB",
    STAGE_WEBHOOK_SECRET: "stage-webhook-secret-CCC",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "launchpad@sample-project.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\nsample-private-key-material\n-----END PRIVATE KEY-----",
    ALERT_WEBHOOK_URL: "https://alerts.example/hook",
    ADMIN_PASSWORD: "admin-password-XYZ",
    ADMIN_SESSION_SECRET: "admin-session-secret-XYZ",
  };
}

export function memoryProfileResolver(
  profiles: readonly PaidFunnelResolvedProfile[]
): ClientIntegrationProfileResolver {
  const byId = new Map(profiles.map(profile => [profile.clientId, profile]));
  return {
    resolveByClientId(clientId) {
      return byId.get(clientId) ?? null;
    },
  };
}
