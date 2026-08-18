import { eq } from "drizzle-orm";
import { paidFunnelTemplateVersions } from "../../drizzle/schema";
import type { GenericPaidFunnelResourceDefinitions } from "../../shared/genericPaidFunnelPublish";
import type { PaidFunnelGraph } from "../../shared/paidFunnel/graph";
import {
  parsePaidFunnelPackage,
  type PaidFunnelPackage,
} from "../../shared/paidFunnelContract";
import {
  createClientIntegrationProfileResolver,
  loadOrBackfillResolvedClientIntegrationProfile,
} from "../clientIntegrations";
import { getClientById, getDb } from "../db";
import { getPaidFunnelDetail } from "../paidFunnelDb";
import { buildGenericPaidFunnelSourceBundle } from "../studio/paidFunnel/sourceBundle";
import { decryptSetupValue, encryptSetupValue } from "../clientSecurity";

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

export type GenericPaidFunnelMaterialSnapshot = Pick<
  GenericPaidFunnelPublishMaterial,
  "files" | "runtimeVars" | "runtimeSecrets"
>;

function stringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (
    entries.some(([key, entry]) => !key || typeof entry !== "string" || !entry)
  ) {
    return null;
  }
  return Object.fromEntries(entries);
}

function parseMaterialSnapshot(
  value: unknown
): GenericPaidFunnelMaterialSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Protected paid funnel material snapshot is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.files)) {
    throw new Error("Protected paid funnel material snapshot is invalid.");
  }
  const files = record.files.map(file => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new Error("Protected paid funnel material snapshot is invalid.");
    }
    const candidate = file as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      !candidate.path ||
      candidate.path.startsWith("/") ||
      candidate.path.includes("..") ||
      typeof candidate.content !== "string"
    ) {
      throw new Error("Protected paid funnel material snapshot is invalid.");
    }
    return { path: candidate.path, content: candidate.content };
  });
  const runtimeVars = stringRecord(record.runtimeVars);
  const runtimeSecrets = stringRecord(record.runtimeSecrets);
  if (
    !runtimeVars ||
    !runtimeSecrets ||
    Object.keys(runtimeSecrets).length === 0
  ) {
    throw new Error("Protected paid funnel material snapshot is invalid.");
  }
  return { files, runtimeVars, runtimeSecrets };
}

export function sealGenericPaidFunnelMaterialSnapshot(
  material: GenericPaidFunnelMaterialSnapshot
): string {
  return encryptSetupValue(JSON.stringify(parseMaterialSnapshot(material)));
}

export function openGenericPaidFunnelMaterialSnapshot(
  encrypted: string | null
): GenericPaidFunnelMaterialSnapshot {
  if (!encrypted)
    throw new Error("Protected paid funnel material snapshot is missing.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decryptSetupValue(encrypted));
  } catch {
    throw new Error("Protected paid funnel material snapshot is invalid.");
  }
  return parseMaterialSnapshot(parsed);
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

function requireSupportedResources(
  pkg: PaidFunnelPackage,
  resourceName: string
): GenericPaidFunnelResourceDefinitions {
  const resources = pkg.resources ?? [];
  if (resources.some(resource => resource.type !== "d1")) {
    throw new Error(
      "This paid funnel declares infrastructure that the generic Astro publisher does not support."
    );
  }
  const d1 = resources.map((database, index) => ({
    binding: database.binding ?? "",
    name: `${resourceName}-${index + 1}`,
  }));
  if (d1.length !== 1 || d1[0]?.binding !== "FUNNEL_DB") {
    throw new Error(
      "Generic Astro funnels require exactly one FUNNEL_DB D1 binding."
    );
  }
  return { d1 };
}

export function genericPaidFunnelResourceDefinitions(
  pkg: PaidFunnelPackage,
  resourceName: string
): GenericPaidFunnelResourceDefinitions {
  return requireSupportedResources(pkg, resourceName);
}

export async function getGenericPaidFunnelPublishMaterial(
  clientId: number,
  funnelId: number
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
  let pkg: PaidFunnelPackage;
  try {
    pkg = parsePaidFunnelPackage(version.packageJson);
  } catch {
    throw new Error("Paid funnel template package is invalid.");
  }
  if (pkg.publishAdapter === "legacy-simple-form") {
    throw new Error("Use the specialized Simple Form adapter.");
  }
  if (pkg.publishAdapter !== "generic-paid-funnel") {
    throw new Error("Unknown paid-funnel publish adapter.");
  }

  const graph = detail.studio.graph;
  const bundle = buildGenericPaidFunnelSourceBundle({
    clientId,
    funnelId,
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
    files: bundle.files.map(file => ({
      path: file.path,
      content: file.contents,
    })),
    runtimeVars: Object.fromEntries(
      Object.entries(bundle.runtimeVars).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].length > 0
      )
    ),
    runtimeSecrets: Object.fromEntries(
      Object.entries(bundle.bindings.secrets).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].length > 0
      )
    ),
  };
}
