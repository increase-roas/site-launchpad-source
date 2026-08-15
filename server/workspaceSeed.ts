import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  funnelSteps,
  funnels,
  homepageSections,
  sitePages,
} from "../drizzle/schema";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_SITE_PAGES,
  FUNNEL_SHAPES,
  type FunnelStepDefinition,
} from "../shared/workspace";
import { isDuplicateKeyError } from "./trpcErrors";

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
  const [existingPages, existingSections, existingFunnels] = await Promise.all([
    db.select().from(sitePages).where(eq(sitePages.clientId, clientId)),
    db.select().from(homepageSections).where(eq(homepageSections.clientId, clientId)),
    db.select().from(funnels).where(eq(funnels.clientId, clientId)),
  ]);

  if (existingPages.length === 0) {
    try {
      await db.insert(sitePages).values(
        DEFAULT_SITE_PAGES.map(page => ({
          clientId,
          ...page,
          status: "draft" as const,
          enabled: 1,
        })),
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  if (existingSections.length === 0) {
    try {
      await db.insert(homepageSections).values(
        DEFAULT_HOMEPAGE_SECTIONS.map((section, position) => ({
          clientId,
          sectionType: section.sectionType,
          position,
          enabled: section.enabled,
        })),
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

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
