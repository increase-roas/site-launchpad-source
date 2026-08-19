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
  paidFunnelPersistStepsSchema,
  persistGraphInput,
  studioToPersistSteps,
  studioToStorageGraph,
} from "../shared/paidFunnel/persist";
import { createEmptyGraph, createIdFactory } from "../shared/paidFunnel/graph";
import {
  blankFunnelName,
  blankFunnelSlug,
} from "../shared/paidFunnel/library";
import { ingestPaidFunnelZip } from "../shared/paidFunnelZip";
import { getClientById, getDb } from "./db";
import { isUndefinedRelationError } from "../shared/safePublicError";
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
  if (isUndefinedRelationError(error)) return true;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "DATABASE_OPERATION_TIMEOUT") return true;
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

function uniqueFunnelName(base: string, used: string[]): string {
  if (!used.includes(base)) return base;
  let index = 2;
  while (used.includes(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
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

    return [
      fixtureTemplate(null),
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
  try {
    return await createPaidFunnelFromTemplateUnsafe(clientId, templateKey);
  } catch (error) {
    if (isPaidFunnelRegistryUnavailable(error)) {
      throw new Error("Paid funnel could not be created from the template.");
    }
    throw error;
  }
}

async function createPaidFunnelFromTemplateUnsafe(
  clientId: number,
  templateKey: string
) {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const db = await requireDb();
  const used = await db
    .select({ slug: paidFunnels.slug, name: paidFunnels.name })
    .from(paidFunnels)
    .where(eq(paidFunnels.clientId, clientId));

  if (templateKey === GENERIC_PAID_FUNNEL_TEMPLATE_KEY) {
    const baseName = genericPaidFunnelName(client.businessName);
    const funnelId = await insertFunnelFromPackage(
      clientId,
      GENERIC_PAID_FUNNEL_PACKAGE,
      "fixture",
      uniqueFunnelName(baseName, used.map(row => row.name)),
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

export async function createBlankPaidFunnel(clientId: number, name?: string) {
  try {
    return await createBlankPaidFunnelUnsafe(clientId, name);
  } catch (error) {
    if (isPaidFunnelRegistryUnavailable(error)) {
      throw new Error("Blank funnel could not be created.");
    }
    throw error;
  }
}

async function createBlankPaidFunnelUnsafe(clientId: number, name?: string) {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const db = await requireDb();
  const used = await db
    .select({ slug: paidFunnels.slug, name: paidFunnels.name })
    .from(paidFunnels)
    .where(eq(paidFunnels.clientId, clientId));
  const funnelName = uniqueFunnelName(
    name?.trim() || blankFunnelName(client.businessName),
    used.map(row => row.name)
  );
  const slug = blankFunnelSlug(
    client.shortName,
    used.map(row => row.slug)
  );
  const studioGraph = createEmptyGraph({
    funnelKey: slug,
    name: funnelName,
    nextId: createIdFactory("blank"),
  });
  const storageGraph = persistGraphInput(studioToStorageGraph(studioGraph));
  const persistSteps = studioToPersistSteps(studioGraph);

  return db.transaction(async transaction => {
    const insertedFunnel = await transaction
      .insert(paidFunnels)
      .values({
        clientId,
        templateVersionId: null,
        name: funnelName,
        slug,
        source: "template",
        status: "draft",
      })
      .returning({ id: paidFunnels.id });
    const funnelId = requireSinglePositiveId(
      insertedFunnel,
      "Blank funnel could not be created."
    );

    const landing = persistSteps[0];
    if (!landing) throw new Error("Blank funnel is missing its empty page.");
    const insertedStep = await transaction
      .insert(paidFunnelSteps)
      .values({
        funnelId,
        position: landing.position,
        key: landing.key,
        stepType: landing.stepType,
        slug: landing.slug,
        title: landing.title,
        seo: landing.seo,
        nextStep: landing.nextStep,
        previewState: landing.previewState,
        publishState: landing.publishState,
      })
      .returning({ id: paidFunnelSteps.id });
    const stepId = requireSinglePositiveId(
      insertedStep,
      "Funnel step could not be created."
    );

    const insertedGraph = await transaction
      .insert(paidFunnelGraphs)
      .values({
        funnelId,
        stepId,
        graphVersion: storageGraph.version,
        graphJson: storageGraph as Record<string, unknown>,
      })
      .returning({ id: paidFunnelGraphs.id });
    const graphId = requireSinglePositiveId(
      insertedGraph,
      "Funnel graph could not be created."
    );
    await transaction.insert(paidFunnelGraphRevisions).values({
      graphId,
      revision: 1,
      graphJson: storageGraph as Record<string, unknown>,
    });

    return { alreadyExists: false as const, funnelId };
  });
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
  steps?: unknown;
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

  const graph = persistGraphInput(input.graph);
  const steps = input.steps
    ? paidFunnelPersistStepsSchema.parse(input.steps)
    : null;
  await db.transaction(async transaction => {
    // Lock before comparing the version. PostgreSQL default timestamps retain
    // microseconds while JavaScript Date values only retain milliseconds, so a
    // SQL equality predicate against a round-tripped Date can reject the first
    // valid edit. The row lock preserves optimistic concurrency without relying
    // on that lossy SQL timestamp comparison.
    const graphRows = await transaction
      .select()
      .from(paidFunnelGraphs)
      .where(
        and(
          eq(paidFunnelGraphs.funnelId, input.funnelId),
          eq(paidFunnelGraphs.stepId, input.stepId)
        )
      )
      .for("update");
    const current = graphRows[0];
    if (!current) throw new Error("Graph not found.");
    assertWritableVersion(current.updatedAt, input.expectedUpdatedAt);

    const revisionRows = await transaction
      .select({ revision: paidFunnelGraphRevisions.revision })
      .from(paidFunnelGraphRevisions)
      .where(eq(paidFunnelGraphRevisions.graphId, current.id))
      .orderBy(desc(paidFunnelGraphRevisions.revision))
      .limit(1);
    const nextRevision = (revisionRows[0]?.revision ?? 0) + 1;
    // The version token must always advance, including API-level saves that
    // arrive within the same millisecond.
    const now = new Date(
      Math.max(Date.now(), current.updatedAt.getTime() + 1)
    );

    if (steps) {
      const existingSteps = await transaction
        .select()
        .from(paidFunnelSteps)
        .where(eq(paidFunnelSteps.funnelId, input.funnelId))
        .for("update");
      const requestedKeys = new Set(steps.map(step => step.key));
      const removed = existingSteps.filter(step => !requestedKeys.has(step.key));
      if (removed.some(step => step.stepType !== "survey" || !/^survey-question-\d+$/.test(step.key))) {
        throw new Error("Only custom survey questions can be removed from this editor.");
      }
      if (removed.some(step => step.id === current.stepId)) {
        throw new Error("The graph storage step cannot be removed.");
      }
      const removedKeys = new Set(removed.map(step => step.key));
      if (steps.some(step => step.nextStep && removedKeys.has(step.nextStep))) {
        throw new Error("A funnel step still routes to a removed survey question.");
      }
      if (graph.pages.some(page => removedKeys.has(page.stepKey))) {
        throw new Error("A removed survey question still has a page graph.");
      }

      // Vacate the unique (funnelId, position) slots before applying a reorder.
      for (const step of existingSteps) {
        await transaction
          .update(paidFunnelSteps)
          .set({ position: -(step.id + 1), updatedAt: now })
          .where(eq(paidFunnelSteps.id, step.id));
      }

      for (const step of steps) {
        const existing = existingSteps.find(row => row.key === step.key);
        const values = {
          position: step.position,
          stepType: step.stepType,
          slug: step.slug,
          title: step.title,
          seo: step.seo,
          nextStep: step.nextStep,
          previewState: step.previewState,
          publishState: step.publishState,
          updatedAt: now,
        };
        if (existing) {
          await transaction
            .update(paidFunnelSteps)
            .set(values)
            .where(eq(paidFunnelSteps.id, existing.id));
        } else {
          await transaction.insert(paidFunnelSteps).values({
            funnelId: input.funnelId,
            key: step.key,
            ...values,
          });
        }
      }

      for (const step of removed) {
        await transaction
          .delete(paidFunnelSteps)
          .where(eq(paidFunnelSteps.id, step.id));
      }
    }

    const updated = await transaction
      .update(paidFunnelGraphs)
      .set({
        graphJson: graph as Record<string, unknown>,
        graphVersion: graph.version,
        updatedAt: now,
      })
      .where(eq(paidFunnelGraphs.id, current.id))
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
