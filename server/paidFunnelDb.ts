import { and, desc, eq } from "drizzle-orm";
import {
  paidFunnelGraphRevisions,
  paidFunnelGraphs,
  paidFunnelReusableSections,
  paidFunnelSteps,
  paidFunnelTemplateArtifacts,
  paidFunnelTemplateVersions,
  paidFunnelTemplates,
  paidFunnels,
} from "../drizzle/schema";
import {
  GENERIC_PAID_FUNNEL_TEMPLATE_KEY,
  parsePaidFunnelPackage,
  type PaidFunnelPackage,
  type PaidFunnelUnsupportedRegionError,
} from "../shared/paidFunnelContract";
import {
  GENERIC_PAID_FUNNEL_PACKAGE,
  genericPaidFunnelName,
  genericPaidFunnelSlug,
} from "../shared/paidFunnelFixture";
import { instantiatePaidFunnel } from "../shared/paidFunnelInstantiate";
import {
  migratePaidFunnelGraph,
  paidFunnelSectionSchema,
} from "../shared/paidFunnelGraph";
import {
  assembleStudioGraph,
  persistGraphInput,
} from "../shared/paidFunnel/persist";
import { ingestPaidFunnelZip } from "../shared/paidFunnelZip";
import { getClientById, getDb } from "./db";
import { requireSinglePositiveId, withUpdatedAt } from "./postgresPersistence";
import { UpdateConflictError, assertWritableVersion } from "./trpcErrors";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

function publicTemplate(
  pkg: PaidFunnelPackage,
  extra: Record<string, unknown> = {}
) {
  return {
    templateKey: pkg.templateKey,
    name: pkg.name,
    version: pkg.version,
    kind: pkg.kind,
    framework: pkg.framework,
    publishAdapter: pkg.publishAdapter,
    previewEntry: pkg.previewEntry,
    stepCount: pkg.steps.length,
    requiredRuntimeSecrets: pkg.requiredRuntimeSecrets,
    resources: pkg.resources,
    ...extra,
  };
}

const PAID_FUNNEL_REGISTRY_TABLES = [
  "paid_funnel_templates",
  "paid_funnel_template_versions",
  "paid_funnels",
] as const;

export function isPaidFunnelRegistryUnavailable(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "42P01" || code === "DATABASE_OPERATION_TIMEOUT") return true;
  if (/Database is not available/i.test(message)) return true;
  return PAID_FUNNEL_REGISTRY_TABLES.some(table =>
    new RegExp(`relation ["']?${table}["']? does not exist`, "i").test(message)
  );
}

function fixtureTemplate(existingFunnelId: number | null = null) {
  return publicTemplate(GENERIC_PAID_FUNNEL_PACKAGE, {
    source: "fixture",
    status: "ready",
    existingFunnelId,
  });
}

export async function listPaidFunnelTemplates(clientId: number) {
  const fallback = [fixtureTemplate(null)];
  try {
    const db = await requireDb();
    const rows = await db
      .select({
        template: paidFunnelTemplates,
        version: paidFunnelTemplateVersions,
      })
      .from(paidFunnelTemplates)
      .leftJoin(
        paidFunnelTemplateVersions,
        eq(paidFunnelTemplateVersions.templateId, paidFunnelTemplates.id)
      )
      .where(eq(paidFunnelTemplates.active, 1))
      .limit(50);

    const hasGeneric = rows.some(
      row => row.template.templateKey === GENERIC_PAID_FUNNEL_TEMPLATE_KEY
    );
    if (!hasGeneric) {
      try {
        await ensureTemplateVersion(
          db,
          GENERIC_PAID_FUNNEL_PACKAGE,
          "ready",
          []
        );
      } catch (error) {
        if (!isPaidFunnelRegistryUnavailable(error)) throw error;
      }
    }

    const imported = rows
      .filter(row => row.version)
      .flatMap(row => {
        try {
          const pkg = parsePaidFunnelPackage(row.version!.packageJson);
          return [
            publicTemplate(pkg, {
              source: "zip",
              status: row.version!.status,
              existingFunnelId: null,
            }),
          ];
        } catch {
          return [];
        }
      });

    const existing = await db
      .select({ id: paidFunnels.id })
      .from(paidFunnels)
      .where(eq(paidFunnels.clientId, clientId))
      .limit(1);

    return [
      fixtureTemplate(existing[0]?.id ?? null),
      ...imported.filter(
        item => item.templateKey !== GENERIC_PAID_FUNNEL_TEMPLATE_KEY
      ),
    ];
  } catch (error) {
    if (isPaidFunnelRegistryUnavailable(error)) {
      return fallback;
    }
    throw error;
  }
}

async function ensureTemplateVersion(
  db: Awaited<ReturnType<typeof requireDb>>,
  pkg: PaidFunnelPackage,
  status: "draft" | "ready" | "unsupported",
  unsupportedErrors: PaidFunnelUnsupportedRegionError[]
) {
  const existingTemplate = await db
    .select()
    .from(paidFunnelTemplates)
    .where(eq(paidFunnelTemplates.templateKey, pkg.templateKey))
    .limit(1);
  let templateId = existingTemplate[0]?.id;
  if (!templateId) {
    const inserted = await db
      .insert(paidFunnelTemplates)
      .values({
        templateKey: pkg.templateKey,
        name: pkg.name,
        kind: pkg.kind,
        active: 1,
      })
      .returning({ id: paidFunnelTemplates.id });
    templateId = requireSinglePositiveId(
      inserted,
      "Template could not be created."
    );
  }

  const existingVersion = await db
    .select()
    .from(paidFunnelTemplateVersions)
    .where(
      and(
        eq(paidFunnelTemplateVersions.templateId, templateId),
        eq(paidFunnelTemplateVersions.version, pkg.version)
      )
    )
    .limit(1);
  if (existingVersion[0]) {
    await db
      .update(paidFunnelTemplateVersions)
      .set(
        withUpdatedAt({
          framework: pkg.framework,
          packageJson: pkg as Record<string, unknown>,
          status,
          unsupportedErrors,
        })
      )
      .where(eq(paidFunnelTemplateVersions.id, existingVersion[0].id));
    return existingVersion[0].id;
  }

  const insertedVersion = await db
    .insert(paidFunnelTemplateVersions)
    .values({
      templateId,
      version: pkg.version,
      framework: pkg.framework,
      packageJson: pkg as Record<string, unknown>,
      status,
      unsupportedErrors,
    })
    .returning({ id: paidFunnelTemplateVersions.id });
  return requireSinglePositiveId(
    insertedVersion,
    "Template version could not be created."
  );
}

export async function ensureGenericPaidFunnelTemplate() {
  const db = await requireDb();
  return ensureTemplateVersion(
    db,
    GENERIC_PAID_FUNNEL_PACKAGE,
    "ready",
    []
  );
}

async function insertFunnelFromPackage(
  clientId: number,
  pkg: PaidFunnelPackage,
  source: "fixture" | "zip" | "template",
  name: string,
  slug: string
) {
  const db = await requireDb();
  const instantiation = instantiatePaidFunnel(pkg, { name, slug, source });
  const versionStatus = source === "zip" ? "ready" : "ready";
  const templateVersionId = await ensureTemplateVersion(
    db,
    pkg,
    versionStatus,
    []
  );

  return db.transaction(async transaction => {
    const insertedFunnel = await transaction
      .insert(paidFunnels)
      .values({
        clientId,
        templateVersionId,
        name: instantiation.name,
        slug: instantiation.slug,
        source: instantiation.source,
        status: "draft",
      })
      .returning({ id: paidFunnels.id });
    const funnelId = requireSinglePositiveId(
      insertedFunnel,
      "Paid funnel could not be created."
    );

    const stepIdByKey = new Map<string, number>();
    for (const step of instantiation.steps) {
      const insertedStep = await transaction
        .insert(paidFunnelSteps)
        .values({
          funnelId,
          position: step.position,
          key: step.key,
          stepType: step.stepType,
          slug: step.slug,
          title: step.title,
          seo: step.seo,
          nextStep: step.nextStep,
          previewState: step.previewState,
          publishState: step.publishState,
        })
        .returning({ id: paidFunnelSteps.id });
      stepIdByKey.set(
        step.key,
        requireSinglePositiveId(
          insertedStep,
          "Funnel step could not be created."
        )
      );
    }

    for (const graph of instantiation.graphs) {
      const stepId = stepIdByKey.get(graph.stepKey);
      if (!stepId) continue;
      const insertedGraph = await transaction
        .insert(paidFunnelGraphs)
        .values({
          funnelId,
          stepId,
          graphVersion: graph.graphVersion,
          graphJson: graph.graph,
        })
        .returning({ id: paidFunnelGraphs.id });
      const graphId = requireSinglePositiveId(
        insertedGraph,
        "Funnel graph could not be created."
      );
      await transaction.insert(paidFunnelGraphRevisions).values({
        graphId,
        revision: 1,
        graphJson: graph.graph,
      });
    }

    return funnelId;
  });
}

export async function createPaidFunnelFromTemplate(
  clientId: number,
  templateKey: string
) {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const db = await requireDb();
  const used = await db
    .select({ slug: paidFunnels.slug })
    .from(paidFunnels)
    .where(eq(paidFunnels.clientId, clientId));

  if (templateKey === GENERIC_PAID_FUNNEL_TEMPLATE_KEY) {
    const existing = used.length
      ? await db
          .select()
          .from(paidFunnels)
          .where(eq(paidFunnels.clientId, clientId))
      : [];
    const fixtureExisting = existing.find(row => row.source === "fixture");
    if (fixtureExisting) {
      return { alreadyExists: true as const, funnelId: fixtureExisting.id };
    }
    const funnelId = await insertFunnelFromPackage(
      clientId,
      GENERIC_PAID_FUNNEL_PACKAGE,
      "fixture",
      genericPaidFunnelName(client.businessName),
      genericPaidFunnelSlug(
        client.shortName,
        used.map(row => row.slug)
      )
    );
    return { alreadyExists: false as const, funnelId };
  }

  const versionRows = await db
    .select({
      version: paidFunnelTemplateVersions,
      template: paidFunnelTemplates,
    })
    .from(paidFunnelTemplateVersions)
    .innerJoin(
      paidFunnelTemplates,
      eq(paidFunnelTemplates.id, paidFunnelTemplateVersions.templateId)
    )
    .where(eq(paidFunnelTemplates.templateKey, templateKey))
    .orderBy(desc(paidFunnelTemplateVersions.id))
    .limit(1);
  const row = versionRows[0];
  if (!row) throw new Error("Template not found.");
  const pkg = parsePaidFunnelPackage(row.version.packageJson);
  const funnelId = await insertFunnelFromPackage(
    clientId,
    pkg,
    "template",
    genericPaidFunnelName(client.businessName),
    genericPaidFunnelSlug(
      client.shortName,
      used.map(row => row.slug)
    )
  );
  return { alreadyExists: false as const, funnelId };
}

export async function importPaidFunnelZip(input: {
  clientId: number;
  filename: string;
  zipBase64: string;
  storageKey?: string;
}) {
  const client = await getClientById(input.clientId);
  if (!client) throw new Error("Client not found.");
  const buffer = Buffer.from(input.zipBase64, "base64");
  const intake = ingestPaidFunnelZip(buffer);
  if (!intake.pkg) {
    return {
      status: intake.status,
      unsupportedRegions: intake.unsupportedRegions,
      templateKey: null,
      versionId: null,
    };
  }

  const db = await requireDb();
  const status =
    intake.status === "ready" && intake.unsupportedRegions.length === 0
      ? "ready"
      : "draft";
  const versionId = await ensureTemplateVersion(
    db,
    intake.pkg,
    status === "ready" ? "ready" : "draft",
    intake.unsupportedRegions
  );
  if (input.storageKey) {
    await db.insert(paidFunnelTemplateArtifacts).values({
      versionId,
      storageKey: input.storageKey,
      filename: input.filename,
      mimeType: "application/zip",
      byteSize: buffer.length,
      kind: "zip",
    });
  }
  return {
    status,
    unsupportedRegions: intake.unsupportedRegions,
    templateKey: intake.pkg.templateKey,
    versionId,
    requiredRuntimeSecrets: intake.pkg.requiredRuntimeSecrets,
    resources: intake.pkg.resources,
  };
}

export async function listPaidFunnels(clientId: number) {
  try {
    const db = await requireDb();
    return db
      .select()
      .from(paidFunnels)
      .where(eq(paidFunnels.clientId, clientId))
      .orderBy(desc(paidFunnels.updatedAt))
      .limit(100);
  } catch (error) {
    if (isPaidFunnelRegistryUnavailable(error)) {
      return [];
    }
    throw error;
  }
}

export async function getPaidFunnelDetail(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnelRows = await db
    .select()
    .from(paidFunnels)
    .where(
      and(eq(paidFunnels.id, funnelId), eq(paidFunnels.clientId, clientId))
    )
    .limit(1);
  const funnel = funnelRows[0];
  if (!funnel) throw new Error("Funnel not found.");

  const steps = await db
    .select()
    .from(paidFunnelSteps)
    .where(eq(paidFunnelSteps.funnelId, funnelId));
  const graphs = await db
    .select()
    .from(paidFunnelGraphs)
    .where(eq(paidFunnelGraphs.funnelId, funnelId));

  const orderedSteps = steps.sort((left, right) => left.position - right.position);
  const graphRows = graphs.map(graph => ({
    ...graph,
    graph: migratePaidFunnelGraph(graph.graphJson),
  }));
  const studio =
    graphRows.length > 0
      ? assembleStudioGraph({
          funnel: { id: funnel.id, name: funnel.name, slug: funnel.slug },
          steps: orderedSteps.map(step => ({
            id: step.id,
            key: step.key,
            stepType: step.stepType,
            slug: step.slug,
            title: step.title,
            seo: (step.seo ?? {}) as Record<string, unknown>,
            nextStep: step.nextStep,
            previewState: step.previewState,
            publishState: step.publishState,
            position: step.position,
          })),
          graphs: graphRows.map(row => ({
            stepId: row.stepId,
            updatedAt: row.updatedAt,
            graph: row.graph,
          })),
        })
      : null;

  return {
    funnel,
    steps: orderedSteps,
    graphs: graphRows,
    studio,
  };
}

export async function savePaidFunnelGraph(input: {
  clientId: number;
  funnelId: number;
  stepId: number;
  expectedUpdatedAt: Date;
  graph: unknown;
}) {
  const db = await requireDb();
  const funnelRows = await db
    .select()
    .from(paidFunnels)
    .where(
      and(
        eq(paidFunnels.id, input.funnelId),
        eq(paidFunnels.clientId, input.clientId)
      )
    )
    .limit(1);
  if (!funnelRows[0]) throw new Error("Funnel not found.");

  const graphRows = await db
    .select()
    .from(paidFunnelGraphs)
    .where(
      and(
        eq(paidFunnelGraphs.funnelId, input.funnelId),
        eq(paidFunnelGraphs.stepId, input.stepId)
      )
    )
    .limit(1);
  const current = graphRows[0];
  if (!current) throw new Error("Graph not found.");
  assertWritableVersion(current.updatedAt, input.expectedUpdatedAt);

  const graph = persistGraphInput(input.graph);
  const revisionRows = await db
    .select({ revision: paidFunnelGraphRevisions.revision })
    .from(paidFunnelGraphRevisions)
    .where(eq(paidFunnelGraphRevisions.graphId, current.id))
    .orderBy(desc(paidFunnelGraphRevisions.revision))
    .limit(1);
  const nextRevision = (revisionRows[0]?.revision ?? 0) + 1;
  const now = new Date();

  await db.transaction(async transaction => {
    const updated = await transaction
      .update(paidFunnelGraphs)
      .set({
        graphJson: graph as Record<string, unknown>,
        graphVersion: graph.version,
        updatedAt: now,
      })
      .where(
        and(
          eq(paidFunnelGraphs.id, current.id),
          eq(paidFunnelGraphs.updatedAt, current.updatedAt)
        )
      )
      .returning({ id: paidFunnelGraphs.id });
    if (updated.length !== 1) throw new UpdateConflictError();
    await transaction.insert(paidFunnelGraphRevisions).values({
      graphId: current.id,
      revision: nextRevision,
      graphJson: graph as Record<string, unknown>,
    });
  });

  return getPaidFunnelDetail(input.clientId, input.funnelId);
}

export async function listReusableSections(clientId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(paidFunnelReusableSections)
    .where(eq(paidFunnelReusableSections.clientId, clientId));
}

export async function saveReusableSection(input: {
  clientId: number;
  name: string;
  section: unknown;
}) {
  const section = paidFunnelSectionSchema.parse(input.section);
  const db = await requireDb();
  const inserted = await db
    .insert(paidFunnelReusableSections)
    .values({
      clientId: input.clientId,
      name: input.name,
      sectionJson: section as Record<string, unknown>,
    })
    .returning({ id: paidFunnelReusableSections.id });
  return {
    id: requireSinglePositiveId(
      inserted,
      "Reusable section could not be saved."
    ),
    name: input.name,
    section,
  };
}
