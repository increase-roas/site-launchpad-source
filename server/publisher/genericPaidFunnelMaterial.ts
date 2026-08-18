import { eq } from "drizzle-orm";
import { paidFunnelTemplateVersions } from "../../drizzle/schema";
import type { GenericPaidFunnelResourceDefinitions } from "../../shared/genericPaidFunnelPublish";
import type { PaidFunnelGraph } from "../../shared/paidFunnel/graph";
import {
  parsePaidFunnelPackage,
  type PaidFunnelPackage,
} from "../../shared/studio/paidFunnelPackage";
import {
  createClientIntegrationProfileResolver,
  loadOrBackfillResolvedClientIntegrationProfile,
} from "../clientIntegrations";
import { getClientById, getDb } from "../db";
import { getPaidFunnelDetail } from "../paidFunnelDb";
import { selectPaidFunnelPublishAdapter } from "../studio/paidFunnel/publishAdapter";
import { buildGenericPaidFunnelSourceBundle } from "../studio/paidFunnel/sourceBundle";

export type GenericPaidFunnelPublishMaterial = {
  clientShortName: string;
  funnelName: string;
  templateKey: string;
  templateVersion: string;
  package: PaidFunnelPackage;
  graph: PaidFunnelGraph;
  files: Array<{ path: string; content: string }>;
  runtimeVars: Record<string, string>;
  runtimeSecrets: Record<string, string>;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

function requireSupportedResources(
  pkg: PaidFunnelPackage,
  resourceName: string,
): GenericPaidFunnelResourceDefinitions {
  const resources = pkg.resources ?? {};
  if (
    (resources.kvNamespaces?.length ?? 0) > 0 ||
    (resources.queues?.producers?.length ?? 0) > 0 ||
    (resources.queues?.consumers?.length ?? 0) > 0 ||
    (resources.assets?.length ?? 0) > 0
  ) {
    throw new Error(
      "This paid funnel declares infrastructure that the generic Astro publisher does not support.",
    );
  }
  const d1 = (resources.d1Databases ?? []).map((database, index) => ({
    binding: database.binding,
    name: `${resourceName}-${index + 1}`,
  }));
  if (d1.length !== 1 || d1[0]?.binding !== "FUNNEL_DB") {
    throw new Error("Generic Astro funnels require exactly one FUNNEL_DB D1 binding.");
  }
  return { d1 };
}

export function genericPaidFunnelResourceDefinitions(
  pkg: PaidFunnelPackage,
  resourceName: string,
): GenericPaidFunnelResourceDefinitions {
  return requireSupportedResources(pkg, resourceName);
}

export async function getGenericPaidFunnelPublishMaterial(
  clientId: number,
  funnelId: number,
): Promise<GenericPaidFunnelPublishMaterial> {
  const [client, detail, profile] = await Promise.all([
    getClientById(clientId),
    getPaidFunnelDetail(clientId, funnelId),
    loadOrBackfillResolvedClientIntegrationProfile(clientId),
  ]);
  if (!client) throw new Error("Client not found.");
  if (!detail.funnel.templateVersionId) {
    throw new Error("Paid funnel template version is missing.");
  }
  if (!detail.studio) throw new Error("Paid funnel source is missing.");

  const db = await requireDb();
  const versions = await db
    .select()
    .from(paidFunnelTemplateVersions)
    .where(eq(paidFunnelTemplateVersions.id, detail.funnel.templateVersionId))
    .limit(1);
  const version = versions[0];
  if (!version) throw new Error("Paid funnel template version was not found.");
  const parsed = parsePaidFunnelPackage(version.packageJson);
  if (!parsed.success) throw new Error("Paid funnel template package is invalid.");
  const pkg = parsed.data;
  const selected = selectPaidFunnelPublishAdapter(pkg);
  if (!selected.ok) throw new Error(selected.error);

  const graph = detail.studio.graph;
  const bundle = buildGenericPaidFunnelSourceBundle({
    clientId,
    graph,
    package: pkg,
    resolver: createClientIntegrationProfileResolver([profile]),
  });
  return {
    clientShortName: client.shortName,
    funnelName: detail.funnel.name,
    templateKey: pkg.templateKey,
    templateVersion: pkg.version,
    package: pkg,
    graph,
    files: bundle.files.map(file => ({ path: file.path, content: file.contents })),
    runtimeVars: Object.fromEntries(
      Object.entries(bundle.runtimeVars).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    ),
    runtimeSecrets: Object.fromEntries(
      Object.entries(bundle.bindings.secrets).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    ),
  };
}
