import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { funnelSteps, funnels } from "../drizzle/schema";
import { FUNNEL_SHAPES, type FunnelStepDefinition } from "../shared/workspace";

export type WorkspaceSeedClient = Pick<PostgresJsDatabase, "select" | "insert">;

export function funnelStepRows(funnelId: number, slug: string, definitions: FunnelStepDefinition[]) {
  return definitions.map((definition, position) => ({
    funnelId,
    stepType: definition.stepType,
    position,
    title: definition.title,
    path: `/${slug}${definition.pathSuffix}`,
    capturedFields: definition.capturedFields,
    trackingActions: definition.trackingActions,
  }));
}

export async function seedWorkspaceDefaults(db: WorkspaceSeedClient, clientId: number): Promise<void> {
  const existingFunnels = await db
    .select()
    .from(funnels)
    .where(eq(funnels.clientId, clientId));

  for (const funnel of existingFunnels) {
    const existingSteps = await db
      .select({ id: funnelSteps.id })
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, funnel.id));
    if (existingSteps.length === 0) {
      await db.insert(funnelSteps).values(funnelStepRows(funnel.id, funnel.slug, FUNNEL_SHAPES[funnel.shape]));
    }
  }
}
