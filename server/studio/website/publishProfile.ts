import {
  computeClientIntegrationReadiness,
  isIdentifierKey,
  isSecretKey,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationIdentifiers,
  type ClientIntegrationSecretKey,
} from "../../../shared/clientIntegrationProfile";
import {
  mapProfileToGenericPaidFunnelBindings,
  resolvePaidFunnelProfileByClientId,
  type ClientIntegrationProfileResolver,
} from "../paidFunnel/profileMapping";

export type WebsitePublishLegacyValues = {
  identifiers: Partial<Record<ClientIntegrationIdentifierKey, string>>;
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>;
};

export type AstroSitePublishProfilePlan =
  | {
      ok: true;
      clientId: number;
      runtimeSecrets: Record<string, string>;
    }
  | {
      ok: false;
      clientId: number;
      runtimeSecrets: null;
      error: string;
    };

export type PlanAstroSitePublishFromProfileInput = {
  clientId: number;
  resolver: ClientIntegrationProfileResolver;
  requiredSecretNames: readonly string[];
  legacyValues?: readonly WebsitePublishLegacyValues[];
};

export function conflictingLegacyProfileKeys(input: {
  identifiers: ClientIntegrationIdentifiers;
  secrets: Partial<Record<ClientIntegrationSecretKey, string>>;
  legacyValues?: readonly WebsitePublishLegacyValues[];
}): string[] {
  const conflicted = new Set<string>();
  for (const contribution of input.legacyValues ?? []) {
    for (const [key, raw] of Object.entries(contribution.identifiers)) {
      const value = raw?.trim();
      if (!value || !isIdentifierKey(key)) continue;
      const profileValue = input.identifiers[key]?.trim();
      if (profileValue && profileValue !== value) conflicted.add(key);
    }
    for (const [key, raw] of Object.entries(contribution.secrets)) {
      const value = raw?.trim();
      if (!value || !isSecretKey(key)) continue;
      const profileValue = input.secrets[key]?.trim();
      if (profileValue && profileValue !== value) conflicted.add(key);
    }
  }
  return [...conflicted].sort();
}

export function planAstroSitePublishFromProfile(
  input: PlanAstroSitePublishFromProfileInput,
): AstroSitePublishProfilePlan {
  const resolved = resolvePaidFunnelProfileByClientId(input.clientId, input.resolver);
  if (!resolved.ok) {
    return {
      ok: false,
      clientId: input.clientId,
      runtimeSecrets: null,
      error: resolved.error,
    };
  }

  const { profile } = resolved;
  if (
    profile.dto.reconciliationStatus === "conflict" ||
    profile.dto.conflictedKeys.length > 0
  ) {
    return {
      ok: false,
      clientId: input.clientId,
      runtimeSecrets: null,
      error: "Client integration profile has a reconciliation conflict.",
    };
  }

  const readiness = computeClientIntegrationReadiness({
    identifiers: profile.dto.identifiers,
    secretPresence: profile.dto.secretPresence,
    reconciliationStatus: profile.dto.reconciliationStatus,
  });
  if (!readiness.websiteReady) {
    const missing = readiness.missingWebsiteKeys;
    return {
      ok: false,
      clientId: input.clientId,
      runtimeSecrets: null,
      error:
        missing.length > 0
          ? `Website integration keys are NOT SET: ${missing.join(", ")}.`
          : "Website integration profile is not SET.",
    };
  }

  const legacyConflicts = conflictingLegacyProfileKeys({
    identifiers: profile.dto.identifiers,
    secrets: profile.secrets,
    legacyValues: input.legacyValues,
  });
  if (legacyConflicts.length > 0) {
    return {
      ok: false,
      clientId: input.clientId,
      runtimeSecrets: null,
      error: `Client integration profile conflicts with legacy wrangler or client secret setups: ${legacyConflicts.join(", ")}.`,
    };
  }

  const bindings = mapProfileToGenericPaidFunnelBindings({
    clientId: input.clientId,
    identifiers: profile.dto.identifiers,
    secrets: profile.secrets,
    requiredNames: input.requiredSecretNames,
  });
  const runtimeSecrets: Record<string, string> = {};
  const missingRuntime: string[] = [];
  for (const name of input.requiredSecretNames) {
    const value = bindings.secrets[name]?.trim();
    if (!value) {
      missingRuntime.push(name);
      continue;
    }
    runtimeSecrets[name] = value;
  }
  if (missingRuntime.length > 0) {
    return {
      ok: false,
      clientId: input.clientId,
      runtimeSecrets: null,
      error: `Website runtime secrets are NOT SET: ${missingRuntime.join(", ")}.`,
    };
  }

  return {
    ok: true,
    clientId: input.clientId,
    runtimeSecrets,
  };
}

export function assertAstroSitePublishProfileReady(
  input: PlanAstroSitePublishFromProfileInput,
): { clientId: number; runtimeSecrets: Record<string, string> } {
  const planned = planAstroSitePublishFromProfile(input);
  if (!planned.ok || !planned.runtimeSecrets) {
    throw new Error(planned.ok ? "Website integration profile is not SET." : planned.error);
  }
  return {
    clientId: planned.clientId,
    runtimeSecrets: planned.runtimeSecrets,
  };
}
