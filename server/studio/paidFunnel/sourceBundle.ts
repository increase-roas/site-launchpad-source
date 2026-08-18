import {
  compilePaidFunnelToAstro,
  type AstroOutputFile,
} from "../../../shared/paidFunnel/astroCompiler";
import type { PaidFunnelGraph } from "../../../shared/paidFunnel/graph";
import {
  clientIntegrationFieldError,
  isIdentifierKey,
  isProfileKey,
} from "../../../shared/clientIntegrationProfile";
import { SIMPLE_FORM_CLOUDFLARE_INFRA } from "../../../shared/simpleFormContract";
import type { PaidFunnelPackage } from "../../../shared/studio/paidFunnelPackage";
import { mapGenericPaidFunnelProfileBindings } from "./publishAdapter";
import type {
  ClientIntegrationProfileResolver,
  PaidFunnelAdapterBindings,
} from "./profileMapping";
import { requiredPaidFunnelSecretNames } from "./profileMapping";

export type GenericPaidFunnelSourceBundle = {
  clientId: number;
  files: AstroOutputFile[];
  bindings: PaidFunnelAdapterBindings;
  runtimeVars: Record<string, string>;
};

/**
 * Creates the exact publish handoff from a saved client profile and a Studio graph.
 * Secret values stay in bindings and are never compiled into repository files.
 */
export function buildGenericPaidFunnelSourceBundle(input: {
  clientId: number;
  funnelId: number;
  graph: PaidFunnelGraph;
  package: PaidFunnelPackage;
  resolver: ClientIntegrationProfileResolver;
}): GenericPaidFunnelSourceBundle {
  const mapped = mapGenericPaidFunnelProfileBindings({
    clientId: input.clientId,
    package: input.package,
    resolver: input.resolver,
  });
  if (!mapped.ok) throw new Error(mapped.error);

  const missing = requiredPaidFunnelSecretNames(input.package).filter(
    name => !mapped.bindings.secrets[name]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Client integration profile is missing: ${missing.join(", ")}`
    );
  }
  for (const [name, value] of Object.entries(mapped.bindings.secrets)) {
    if (!isProfileKey(name)) continue;
    const error = clientIntegrationFieldError(name, value);
    if (error) throw new Error(error);
  }

  const files = compilePaidFunnelToAstro(input.graph);
  const serialized = JSON.stringify(files);
  const nonSensitiveNumericSettings = new Set([
    "META_VALUE_QUALIFIED",
    "META_VALUE_SCHEDULE",
    "META_VALUE_SHOWED",
  ]);
  for (const [name, value] of Object.entries(mapped.bindings.secrets)) {
    if (isIdentifierKey(name)) continue;
    if (nonSensitiveNumericSettings.has(name)) continue;
    if (value?.trim() && serialized.includes(value)) {
      throw new Error(
        "A client integration secret was compiled into the Astro source bundle."
      );
    }
  }

  return {
    clientId: input.clientId,
    files,
    bindings: mapped.bindings,
    runtimeVars: {
      ...mapped.bindings.env,
      FUNNEL_SHEET_TAB: `SL-${input.clientId}-${input.funnelId}`,
      META_GRAPH_API_VERSION:
        SIMPLE_FORM_CLOUDFLARE_INFRA.vars.META_GRAPH_API_VERSION,
    },
  };
}
