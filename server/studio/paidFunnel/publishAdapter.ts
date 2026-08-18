import {
  declaredPaidFunnelResources,
  parsePaidFunnelPackage,
  parsePaidFunnelPublishSettings,
  type PaidFunnelPackage,
  type PaidFunnelPublishAdapter,
  type PaidFunnelResources,
} from "../../../shared/studio/paidFunnelPackage";
import {
  authorizePaidFunnelLiveRewrite,
  mapProfileToGenericPaidFunnelBindings,
  requiredPaidFunnelSecretNames,
  resolvePaidFunnelProfileByClientId,
  type ClientIntegrationProfileResolver,
  type PaidFunnelAdapterBindings,
  type PaidFunnelPublishAction,
} from "./profileMapping";
import {
  buildPaidFunnelReadiness,
  paidFunnelReadinessIssues,
  type PaidFunnelReadiness,
} from "./readiness";

export const GENERIC_PAID_FUNNEL_ADAPTER = "generic-paid-funnel" as const;

export const genericPaidFunnelPlanStepValues = [
  "validate_readiness",
  "create_repository",
  "ensure_kv_namespace",
  "ensure_d1_database",
  "ensure_queues",
  "commit_source",
  "dispatch_workflow",
  "monitor_workflow",
  "patch_runtime_secrets",
  "get_live_url",
  "published",
] as const;
export type GenericPaidFunnelPlanStep =
  (typeof genericPaidFunnelPlanStepValues)[number];

export type GenericPaidFunnelPublishPlan = {
  adapter: typeof GENERIC_PAID_FUNNEL_ADAPTER;
  steps: GenericPaidFunnelPlanStep[];
  resources: PaidFunnelResources;
  forcedCloudflareInfra: false;
  clientId: number;
  bindingNames: string[];
  liveSyncAction: PaidFunnelPublishAction;
};

export type GenericPaidFunnelPlanResult =
  | {
      ok: true;
      readiness: PaidFunnelReadiness;
      plan: GenericPaidFunnelPublishPlan;
    }
  | {
      ok: false;
      readiness: PaidFunnelReadiness;
      plan: null;
      error: string;
    };

export type GenericPaidFunnelPlanInput = {
  package: unknown;
  settings: unknown;
  profile?: unknown;
  resolver?: ClientIntegrationProfileResolver;
  hasLiveDeploy?: boolean;
  action?: PaidFunnelPublishAction;
};

export function selectPaidFunnelPublishAdapter(
  rawPackage: unknown
):
  | { ok: true; adapter: PaidFunnelPublishAdapter }
  | { ok: false; error: string } {
  const parsed = parsePaidFunnelPackage(rawPackage);
  if (!parsed.success) {
    return { ok: false, error: "Package is invalid." };
  }
  if (parsed.data.kind !== "paid-funnel") {
    return { ok: false, error: "Website packages are not supported." };
  }
  if (parsed.data.publishAdapter === "legacy-simple-form") {
    return {
      ok: false,
      error: "Use the specialized Simple Form adapter.",
    };
  }
  if (parsed.data.publishAdapter !== GENERIC_PAID_FUNNEL_ADAPTER) {
    return { ok: false, error: "Unknown paid-funnel publish adapter." };
  }
  return { ok: true, adapter: GENERIC_PAID_FUNNEL_ADAPTER };
}

export function planGenericPaidFunnelResources(
  pkg: PaidFunnelPackage
): PaidFunnelResources {
  return declaredPaidFunnelResources(pkg);
}

export function genericPaidFunnelPlanSteps(
  resources: PaidFunnelResources,
  action: PaidFunnelPublishAction = "publish"
): GenericPaidFunnelPlanStep[] {
  if (action === "sync-integrations") {
    return ["validate_readiness", "patch_runtime_secrets", "published"];
  }
  const steps: GenericPaidFunnelPlanStep[] = [
    "validate_readiness",
    "create_repository",
  ];
  if ((resources.kvNamespaces?.length ?? 0) > 0) {
    steps.push("ensure_kv_namespace");
  }
  if ((resources.d1Databases?.length ?? 0) > 0) {
    steps.push("ensure_d1_database");
  }
  const queues = resources.queues;
  if (
    (queues?.producers?.length ?? 0) > 0 ||
    (queues?.consumers?.length ?? 0) > 0
  ) {
    steps.push("ensure_queues");
  }
  steps.push(
    "commit_source",
    "dispatch_workflow",
    "monitor_workflow",
    "patch_runtime_secrets",
    "get_live_url",
    "published"
  );
  return steps;
}

function resolveProfileForPlan(input: GenericPaidFunnelPlanInput): unknown {
  if (input.profile !== undefined) return input.profile;
  const settings = parsePaidFunnelPublishSettings(input.settings);
  if (!settings.success || !input.resolver) return undefined;
  const resolved = resolvePaidFunnelProfileByClientId(
    settings.data.clientId,
    input.resolver
  );
  return resolved.ok ? resolved.profile.dto : undefined;
}

export function planGenericPaidFunnelPublish(
  rawPackage: unknown,
  rawSettings: unknown,
  rawProfile?: unknown,
  options?: {
    resolver?: ClientIntegrationProfileResolver;
    hasLiveDeploy?: boolean;
    action?: PaidFunnelPublishAction;
  }
): GenericPaidFunnelPlanResult {
  const input: GenericPaidFunnelPlanInput = {
    package: rawPackage,
    settings: rawSettings,
    profile: rawProfile,
    resolver: options?.resolver,
    hasLiveDeploy: options?.hasLiveDeploy,
    action: options?.action,
  };
  const profile = resolveProfileForPlan(input);
  const readiness = buildPaidFunnelReadiness(rawPackage, rawSettings, profile);
  if (!readiness.configurationReady) {
    return {
      ok: false,
      readiness,
      plan: null,
      error:
        paidFunnelReadinessIssues(readiness)[0] ??
        "Paid funnel is not ready to publish.",
    };
  }

  const live = authorizePaidFunnelLiveRewrite({
    hasLiveDeploy: options?.hasLiveDeploy === true,
    action: options?.action,
  });
  if (!live.ok) {
    return {
      ok: false,
      readiness,
      plan: null,
      error: live.error,
    };
  }

  const selected = selectPaidFunnelPublishAdapter(rawPackage);
  if (!selected.ok) {
    return {
      ok: false,
      readiness,
      plan: null,
      error: selected.error,
    };
  }

  const parsed = parsePaidFunnelPackage(rawPackage);
  const settings = parsePaidFunnelPublishSettings(rawSettings);
  if (!parsed.success || !settings.success) {
    return {
      ok: false,
      readiness,
      plan: null,
      error: "Package is invalid.",
    };
  }

  const resources = planGenericPaidFunnelResources(parsed.data);
  return {
    ok: true,
    readiness,
    plan: {
      adapter: GENERIC_PAID_FUNNEL_ADAPTER,
      steps: genericPaidFunnelPlanSteps(resources, live.action),
      resources,
      forcedCloudflareInfra: false,
      clientId: settings.data.clientId,
      bindingNames: requiredPaidFunnelSecretNames(parsed.data),
      liveSyncAction: live.action,
    },
  };
}

export function assertGenericPaidFunnelPublishAuthorized(
  rawPackage: unknown,
  rawSettings: unknown,
  rawProfile?: unknown,
  options?: {
    resolver?: ClientIntegrationProfileResolver;
    hasLiveDeploy?: boolean;
    action?: PaidFunnelPublishAction;
  }
): GenericPaidFunnelPublishPlan {
  const planned = planGenericPaidFunnelPublish(
    rawPackage,
    rawSettings,
    rawProfile,
    options
  );
  if (!planned.ok || !planned.plan) {
    throw new Error(
      planned.ok ? "Paid funnel is not ready to publish." : planned.error
    );
  }
  return planned.plan;
}

export function genericPaidFunnelUsesForcedInfra(
  plan: GenericPaidFunnelPublishPlan
): boolean {
  return (
    (plan.forcedCloudflareInfra ||
      plan.steps.includes("ensure_kv_namespace") ||
      plan.steps.includes("ensure_d1_database") ||
      plan.steps.includes("ensure_queues")) &&
    (plan.resources.kvNamespaces?.length ?? 0) === 0 &&
    (plan.resources.d1Databases?.length ?? 0) === 0 &&
    (plan.resources.queues?.producers?.length ?? 0) === 0 &&
    (plan.resources.queues?.consumers?.length ?? 0) === 0
  );
}

export function mapGenericPaidFunnelProfileBindings(input: {
  clientId: number;
  package: PaidFunnelPackage;
  resolver: ClientIntegrationProfileResolver;
}):
  | { ok: true; bindings: PaidFunnelAdapterBindings }
  | { ok: false; error: string } {
  const resolved = resolvePaidFunnelProfileByClientId(
    input.clientId,
    input.resolver
  );
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    bindings: mapProfileToGenericPaidFunnelBindings({
      clientId: input.clientId,
      identifiers: resolved.profile.dto.identifiers,
      secrets: resolved.profile.secrets,
      requiredNames: [
        ...requiredPaidFunnelSecretNames(input.package),
        "ALERT_WEBHOOK_URL",
        "META_VALUE_QUALIFIED",
        "META_VALUE_SCHEDULE",
        "META_VALUE_SHOWED",
      ],
    }),
  };
}
