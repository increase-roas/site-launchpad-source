import { and, asc, eq } from "drizzle-orm";
import {
  funnelSteps,
  funnels,
  homepageSections,
  sitePages,
  type Funnel,
  type FunnelShape,
  type HomepageSection,
  type SitePage,
} from "../drizzle/schema";
import { FUNNEL_SHAPES, type HomepageSectionType } from "../shared/workspace";
import { getClientById, getDb } from "./db";
import { withUpdatedAt } from "./postgresPersistence";
import { funnelStepRows, seedWorkspaceDefaults } from "./workspaceSeed";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function ensureWorkspaceDefaults(clientId: number): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const db = await requireDb();
  await seedWorkspaceDefaults(db, clientId);
}

export async function getWorkspace(clientId: number): Promise<{
  pages: SitePage[];
  funnels: Array<Funnel & { steps: Awaited<ReturnType<typeof getFunnelSteps>> }>;
  sections: HomepageSection[];
}> {
  await ensureWorkspaceDefaults(clientId);
  const db = await requireDb();
  const [pages, funnelRows, sections] = await Promise.all([
    db.select().from(sitePages).where(eq(sitePages.clientId, clientId)).orderBy(asc(sitePages.id)),
    db.select().from(funnels).where(eq(funnels.clientId, clientId)).orderBy(asc(funnels.id)),
    db
      .select()
      .from(homepageSections)
      .where(eq(homepageSections.clientId, clientId))
      .orderBy(asc(homepageSections.position)),
  ]);

  const funnelsWithSteps = await Promise.all(
    funnelRows.map(async funnel => ({ ...funnel, steps: await getFunnelSteps(funnel.id) })),
  );

  return { pages, funnels: funnelsWithSteps, sections };
}

export async function getFunnelSteps(funnelId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(funnelSteps)
    .where(eq(funnelSteps.funnelId, funnelId))
    .orderBy(asc(funnelSteps.position));
}

export async function replaceFunnelShape(
  clientId: number,
  funnelId: number,
  shape: FunnelShape,
): Promise<void> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, funnelId), eq(funnels.clientId, clientId)))
    .limit(1);
  const funnel = rows[0];
  if (!funnel) throw new Error("Funnel not found.");
  if (funnel.templateKey) {
    throw new Error("This funnel uses a locked template. Shape cannot be changed.");
  }

  await db.transaction(async transaction => {
    await transaction
      .update(funnels)
      .set(withUpdatedAt({ shape }))
      .where(eq(funnels.id, funnelId));
    await transaction.delete(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
    await transaction
      .insert(funnelSteps)
      .values(funnelStepRows(funnelId, funnel.slug, FUNNEL_SHAPES[shape]));
  });
}

export async function updateFunnelStep(
  clientId: number,
  input: {
    stepId: number;
    title: string;
    path: string;
    capturedFields: string[];
    trackingActions: string[];
  },
): Promise<void> {
  const db = await requireDb();
  const rows = await db
    .select({ id: funnelSteps.id })
    .from(funnelSteps)
    .innerJoin(funnels, eq(funnelSteps.funnelId, funnels.id))
    .where(and(eq(funnelSteps.id, input.stepId), eq(funnels.clientId, clientId)))
    .limit(1);
  if (!rows[0]) throw new Error("Funnel step not found.");

  await db
    .update(funnelSteps)
    .set(withUpdatedAt({
      title: input.title,
      path: input.path,
      capturedFields: input.capturedFields,
      trackingActions: input.trackingActions,
    }))
    .where(eq(funnelSteps.id, input.stepId));
}

export async function saveHomepageSectionOrder(
  clientId: number,
  sections: Array<{ id: number; sectionType: HomepageSectionType; enabled: boolean }>,
): Promise<void> {
  const db = await requireDb();
  const existing = await db
    .select({ id: homepageSections.id, sectionType: homepageSections.sectionType })
    .from(homepageSections)
    .where(eq(homepageSections.clientId, clientId));
  const existingById = new Map(existing.map(section => [section.id, section.sectionType]));

  if (
    sections.length !== existing.length ||
    sections.some(section => existingById.get(section.id) !== section.sectionType)
  ) {
    throw new Error("Homepage sections do not match this client.");
  }

  await db.transaction(async transaction => {
    for (let index = 0; index < sections.length; index += 1) {
      await transaction
        .update(homepageSections)
        .set(withUpdatedAt({ position: 1000 + index }))
        .where(eq(homepageSections.id, sections[index].id));
    }
    for (let index = 0; index < sections.length; index += 1) {
      await transaction
        .update(homepageSections)
        .set(withUpdatedAt({ position: index, enabled: sections[index].enabled ? 1 : 0 }))
        .where(eq(homepageSections.id, sections[index].id));
    }
  });
}
