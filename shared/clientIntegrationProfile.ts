import { z } from "zod";
import { WRANGLER_SECRET_VALUES, type WranglerSecretName } from "./astroConfig";
import {
  SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS,
  SIMPLE_FORM_CLIENT_SECRET_KEYS,
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  SIMPLE_FORM_RUNTIME_SECRET_KEYS,
} from "./simpleFormContract";

const wranglerSecretSet = new Set<string>(WRANGLER_SECRET_VALUES);

function assertCanonicalKeys(
  keys: readonly string[],
  label: string,
): asserts keys is readonly WranglerSecretName[] {
  const invented = keys.filter(key => !wranglerSecretSet.has(key));
  if (invented.length > 0) {
    throw new Error(`${label} invented non-canonical keys: ${invented.join(", ")}`);
  }
}

export const CLIENT_INTEGRATION_IDENTIFIER_KEYS = [
  ...SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS,
] as const;
assertCanonicalKeys(CLIENT_INTEGRATION_IDENTIFIER_KEYS, "identifier keys");
export type ClientIntegrationIdentifierKey =
  (typeof CLIENT_INTEGRATION_IDENTIFIER_KEYS)[number];

const SHARED_SECRET_FROM_SIMPLE_FORM = SIMPLE_FORM_CLIENT_SECRET_KEYS.filter(
  (key): key is Exclude<
    (typeof SIMPLE_FORM_CLIENT_SECRET_KEYS)[number],
    ClientIntegrationIdentifierKey
  > => !(CLIENT_INTEGRATION_IDENTIFIER_KEYS as readonly string[]).includes(key),
);
const SHARED_SECRET_FROM_RUNTIME = SIMPLE_FORM_RUNTIME_SECRET_KEYS.filter(
  (key): key is Exclude<
    (typeof SIMPLE_FORM_RUNTIME_SECRET_KEYS)[number],
    ClientIntegrationIdentifierKey | (typeof SHARED_SECRET_FROM_SIMPLE_FORM)[number]
  > =>
    !(CLIENT_INTEGRATION_IDENTIFIER_KEYS as readonly string[]).includes(key) &&
    !(SHARED_SECRET_FROM_SIMPLE_FORM as readonly string[]).includes(key),
);

export const CLIENT_INTEGRATION_SHARED_SECRET_KEYS = [
  ...SHARED_SECRET_FROM_SIMPLE_FORM,
  ...SHARED_SECRET_FROM_RUNTIME,
] as const;
assertCanonicalKeys(CLIENT_INTEGRATION_SHARED_SECRET_KEYS, "shared secret keys");
export type ClientIntegrationSharedSecretKey =
  (typeof CLIENT_INTEGRATION_SHARED_SECRET_KEYS)[number];

export const CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS = WRANGLER_SECRET_VALUES.filter(
  (key): key is Exclude<
    WranglerSecretName,
    ClientIntegrationIdentifierKey | ClientIntegrationSharedSecretKey
  > =>
    !(CLIENT_INTEGRATION_IDENTIFIER_KEYS as readonly string[]).includes(key) &&
    !(CLIENT_INTEGRATION_SHARED_SECRET_KEYS as readonly string[]).includes(key),
);
assertCanonicalKeys(CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS, "website-only keys");
export type ClientIntegrationWebsiteOnlyKey =
  (typeof CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS)[number];

export const CLIENT_INTEGRATION_SECRET_KEYS = [
  ...CLIENT_INTEGRATION_SHARED_SECRET_KEYS,
  ...CLIENT_INTEGRATION_WEBSITE_ONLY_KEYS,
] as const;
export type ClientIntegrationSecretKey = (typeof CLIENT_INTEGRATION_SECRET_KEYS)[number];

export const CLIENT_INTEGRATION_PROFILE_KEYS = [
  ...CLIENT_INTEGRATION_IDENTIFIER_KEYS,
  ...CLIENT_INTEGRATION_SECRET_KEYS,
] as const;
export type ClientIntegrationProfileKey =
  (typeof CLIENT_INTEGRATION_PROFILE_KEYS)[number];

export const FORBIDDEN_PROFILE_KEYS = ["GHL_WEBHOOK_URL", "CRM_CALLBACK_SECRET"] as const;
export const LEGACY_SECRET_KEY_ALIASES = {
  GHL_WEBHOOK_URL: "GHL_API_KEY",
  CRM_CALLBACK_SECRET: "STAGE_WEBHOOK_SECRET",
} as const;
export type LegacySecretKeyAlias = keyof typeof LEGACY_SECRET_KEY_ALIASES;

export const OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS = ["ALERT_WEBHOOK_URL"] as const;

export const FUNNEL_REQUIRED_PROFILE_KEYS =
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets;
export const WEBSITE_REQUIRED_PROFILE_KEYS = WRANGLER_SECRET_VALUES.filter(
  key => !(OPTIONAL_CLIENT_INTEGRATION_SECRET_KEYS as readonly string[]).includes(key),
);

export const CLIENT_INTEGRATION_RECONCILIATION_STATUS_VALUES = [
  "pending",
  "ready",
  "conflict",
] as const;
export type ClientIntegrationReconciliationStatus =
  (typeof CLIENT_INTEGRATION_RECONCILIATION_STATUS_VALUES)[number];

export const CLIENT_INTEGRATION_SOURCE_VALUES = [
  "clientLeadIntegrations",
  "wranglerSecretSetups",
  "clientSecretSetups",
  "funnelRuntimeSecrets",
] as const;
export type ClientIntegrationSource = (typeof CLIENT_INTEGRATION_SOURCE_VALUES)[number];

export const SECRET_PRESENCE_VALUES = ["SET", "NOT SET"] as const;
export type SecretPresence = (typeof SECRET_PRESENCE_VALUES)[number];

export const CLIENT_INTEGRATION_UI_GROUPS = [
  { id: "ghl", label: "GHL", keys: ["GHL_LOCATION_ID", "GHL_API_KEY"] as const },
  {
    id: "sheets",
    label: "Google Sheets",
    keys: [
      "GOOGLE_SHEETS_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ] as const,
  },
  {
    id: "meta",
    label: "Meta",
    keys: [
      "META_PIXEL_ID",
      "META_CAPI_ACCESS_TOKEN",
      "META_VALUE_QUALIFIED",
      "META_VALUE_SCHEDULE",
      "META_VALUE_SHOWED",
    ] as const,
  },
  {
    id: "callbacks",
    label: "Callbacks/Alerts",
    keys: ["STAGE_WEBHOOK_SECRET", "ALERT_WEBHOOK_URL"] as const,
  },
  {
    id: "other",
    label: "Other shared runtime",
    keys: ["ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"] as const,
  },
] as const;

export const identifierPresenceSchema = z.strictObject({
  GHL_LOCATION_ID: z.string().trim().max(255).nullable(),
  GOOGLE_SHEETS_ID: z.string().trim().max(255).nullable(),
  META_PIXEL_ID: z.string().trim().max(255).nullable(),
});
export type ClientIntegrationIdentifiers = z.infer<typeof identifierPresenceSchema>;

export const secretPresenceSchema = z.strictObject({
  GHL_API_KEY: z.enum(SECRET_PRESENCE_VALUES),
  META_CAPI_ACCESS_TOKEN: z.enum(SECRET_PRESENCE_VALUES),
  STAGE_WEBHOOK_SECRET: z.enum(SECRET_PRESENCE_VALUES),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.enum(SECRET_PRESENCE_VALUES),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.enum(SECRET_PRESENCE_VALUES),
  ALERT_WEBHOOK_URL: z.enum(SECRET_PRESENCE_VALUES),
  ADMIN_PASSWORD: z.enum(SECRET_PRESENCE_VALUES),
  ADMIN_SESSION_SECRET: z.enum(SECRET_PRESENCE_VALUES),
  META_VALUE_QUALIFIED: z.enum(SECRET_PRESENCE_VALUES),
  META_VALUE_SCHEDULE: z.enum(SECRET_PRESENCE_VALUES),
  META_VALUE_SHOWED: z.enum(SECRET_PRESENCE_VALUES),
});
export type ClientIntegrationSecretPresence = z.infer<typeof secretPresenceSchema>;

export const clientIntegrationReadinessSchema = z.strictObject({
  websiteReady: z.boolean(),
  funnelReady: z.boolean(),
  missingWebsiteKeys: z.array(z.string()),
  missingFunnelKeys: z.array(z.string()),
});
export type ClientIntegrationReadiness = z.infer<typeof clientIntegrationReadinessSchema>;

export const clientIntegrationProfileDtoSchema = z.strictObject({
  clientId: z.number().int().positive(),
  identifiers: identifierPresenceSchema,
  secretPresence: secretPresenceSchema,
  groups: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      fields: z.array(
        z.strictObject({
          key: z.string(),
          kind: z.enum(["identifier", "secret"]),
          identifierValue: z.string().nullable().optional(),
          presence: z.enum(SECRET_PRESENCE_VALUES).optional(),
        }),
      ),
    }),
  ),
  readiness: clientIntegrationReadinessSchema,
  lastUpdated: z.date().nullable(),
  reconciliationStatus: z.enum(CLIENT_INTEGRATION_RECONCILIATION_STATUS_VALUES),
  conflictedKeys: z.array(z.string()),
});
export type ClientIntegrationProfileDto = z.infer<typeof clientIntegrationProfileDtoSchema>;

export function emptyIdentifiers(): ClientIntegrationIdentifiers {
  return { GHL_LOCATION_ID: null, GOOGLE_SHEETS_ID: null, META_PIXEL_ID: null };
}

export function emptySecretPresence(): ClientIntegrationSecretPresence {
  return {
    GHL_API_KEY: "NOT SET",
    META_CAPI_ACCESS_TOKEN: "NOT SET",
    STAGE_WEBHOOK_SECRET: "NOT SET",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "NOT SET",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "NOT SET",
    ALERT_WEBHOOK_URL: "NOT SET",
    ADMIN_PASSWORD: "NOT SET",
    ADMIN_SESSION_SECRET: "NOT SET",
    META_VALUE_QUALIFIED: "NOT SET",
    META_VALUE_SCHEDULE: "NOT SET",
    META_VALUE_SHOWED: "NOT SET",
  };
}

export function isIdentifierKey(key: string): key is ClientIntegrationIdentifierKey {
  return (CLIENT_INTEGRATION_IDENTIFIER_KEYS as readonly string[]).includes(key);
}

export function isSecretKey(key: string): key is ClientIntegrationSecretKey {
  return (CLIENT_INTEGRATION_SECRET_KEYS as readonly string[]).includes(key);
}

export function isProfileKey(key: string): key is ClientIntegrationProfileKey {
  return (CLIENT_INTEGRATION_PROFILE_KEYS as readonly string[]).includes(key);
}

export function canonicalizeLegacyKey(key: string): string {
  if (key in LEGACY_SECRET_KEY_ALIASES) {
    return LEGACY_SECRET_KEY_ALIASES[key as keyof typeof LEGACY_SECRET_KEY_ALIASES];
  }
  return key;
}

export function presenceFromValue(value: string | null | undefined): SecretPresence {
  return value && value.trim() ? "SET" : "NOT SET";
}

export function computeClientIntegrationReadiness(input: {
  identifiers: ClientIntegrationIdentifiers;
  secretPresence: ClientIntegrationSecretPresence;
  reconciliationStatus?: ClientIntegrationReconciliationStatus;
}): ClientIntegrationReadiness {
  const set = new Set<string>();
  for (const key of CLIENT_INTEGRATION_IDENTIFIER_KEYS) {
    if (input.identifiers[key]?.trim()) set.add(key);
  }
  for (const key of Object.keys(input.secretPresence) as Array<keyof ClientIntegrationSecretPresence>) {
    if (input.secretPresence[key] === "SET") set.add(key);
  }
  const blocked = input.reconciliationStatus === "conflict";
  const missingWebsiteKeys = WEBSITE_REQUIRED_PROFILE_KEYS.filter(key => !set.has(key));
  const missingFunnelKeys = FUNNEL_REQUIRED_PROFILE_KEYS.filter(key => !set.has(key));
  return {
    websiteReady: !blocked && missingWebsiteKeys.length === 0,
    funnelReady: !blocked && missingFunnelKeys.length === 0,
    missingWebsiteKeys: [...missingWebsiteKeys],
    missingFunnelKeys: [...missingFunnelKeys],
  };
}

export function buildClientIntegrationProfileDto(input: {
  clientId: number;
  identifiers: ClientIntegrationIdentifiers;
  secretPresence: ClientIntegrationSecretPresence;
  lastUpdated: Date | null;
  reconciliationStatus: ClientIntegrationReconciliationStatus;
  conflictedKeys: string[];
}): ClientIntegrationProfileDto {
  const readiness = computeClientIntegrationReadiness(input);
  return clientIntegrationProfileDtoSchema.parse({
    clientId: input.clientId,
    identifiers: input.identifiers,
    secretPresence: input.secretPresence,
    groups: CLIENT_INTEGRATION_UI_GROUPS.map(group => ({
      id: group.id,
      label: group.label,
      fields: group.keys.map(key =>
        isIdentifierKey(key)
          ? { key, kind: "identifier" as const, identifierValue: input.identifiers[key] }
          : { key, kind: "secret" as const, presence: input.secretPresence[key] },
      ),
    })),
    readiness,
    lastUpdated: input.lastUpdated,
    reconciliationStatus: input.reconciliationStatus,
    conflictedKeys: input.conflictedKeys,
  });
}

export function assertDtoOmitsSecretValues(
  dto: ClientIntegrationProfileDto,
  secretValues: readonly string[],
): void {
  const serialized = JSON.stringify(dto);
  for (const value of secretValues) {
    const trimmed = value.trim();
    if (trimmed && serialized.includes(trimmed)) {
      throw new Error("ClientIntegrationProfile DTO leaked a secret value.");
    }
  }
  for (const forbidden of FORBIDDEN_PROFILE_KEYS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`ClientIntegrationProfile DTO exposed legacy key ${forbidden}.`);
    }
  }
}

export function cloneProfileReference(input: {
  sourceClientId: number;
  targetClientId: number;
  sameCustomer: boolean;
}): { clientId: number; copiesSecrets: false } {
  if (input.sameCustomer) {
    return { clientId: input.sourceClientId, copiesSecrets: false };
  }
  return { clientId: input.targetClientId, copiesSecrets: false };
}
