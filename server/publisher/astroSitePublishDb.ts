import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  astroSitePublishes,
  clients,
  type AstroSitePublish,
  type InsertAstroSitePublish,
} from "../../drizzle/schema";
import { getDb } from "../db";
import type {
  AstroSitePublishStepValues,
  AstroSitePublishStore,
} from "./publishAstroSite";

type ReadClient = Pick<PostgresJsDatabase, "select">;
type InsertClient = Pick<PostgresJsDatabase, "insert" | "select">;
type UpdateClient = Pick<PostgresJsDatabase, "update">;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

async function getWithDb(
  db: ReadClient,
  clientId: number,
): Promise<AstroSitePublish | null> {
  const rows = await db
    .select()
    .from(astroSitePublishes)
    .where(eq(astroSitePublishes.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

async function startWithDb(
  db: InsertClient,
  input: Parameters<AstroSitePublishStore["start"]>[0],
): Promise<AstroSitePublish> {
  const inserted = await db
    .insert(astroSitePublishes)
    .values({
      clientId: input.clientId,
      externalSiteId: input.externalSiteId,
      templateKey: input.templateKey,
      templateRepo: input.templateRepo,
      contractVersion: input.contractVersion,
      resourceName: input.resourceName,
      repositoryName: input.repositoryName,
      workerName: input.workerName,
      d1DatabaseName: input.d1DatabaseName,
      r2BucketName: input.r2BucketName,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({ target: astroSitePublishes.clientId })
    .returning();
  const job = inserted[0] ?? (await getWithDb(db, input.clientId));
  if (!job) throw new Error("Website publish job could not be started.");
  if (
    job.templateKey !== input.templateKey ||
    job.templateRepo !== input.templateRepo ||
    job.contractVersion !== input.contractVersion
  ) {
    throw new Error(
      "Existing website publish job uses a different template contract; manual attention is required.",
    );
  }
  return job;
}

function setStepValues(
  target: Partial<InsertAstroSitePublish>,
  values: AstroSitePublishStepValues | undefined,
): void {
  if (!values) return;
  if ("repositoryId" in values) target.repositoryId = values.repositoryId;
  if ("repositoryFullName" in values) target.repositoryFullName = values.repositoryFullName;
  if ("repositoryUrl" in values) target.repositoryUrl = values.repositoryUrl;
  if ("defaultBranch" in values) target.defaultBranch = values.defaultBranch;
  if ("d1DatabaseId" in values) target.d1DatabaseId = values.d1DatabaseId;
  if ("r2BucketId" in values) target.r2BucketId = values.r2BucketId;
  if ("r2PublicUrl" in values) target.r2PublicUrl = values.r2PublicUrl;
  if ("commitSha" in values) target.commitSha = values.commitSha;
  if ("liveUrl" in values) target.liveUrl = values.liveUrl;
  if ("dispatchRequestedAt" in values) target.dispatchRequestedAt = values.dispatchRequestedAt;
  if ("workflowRunId" in values) target.workflowRunId = values.workflowRunId;
  if ("workflowStatus" in values) target.workflowStatus = values.workflowStatus;
  if ("workflowCheckedAt" in values) target.workflowCheckedAt = values.workflowCheckedAt;
  if ("runtimeSecretsPatchedAt" in values) {
    target.runtimeSecretsPatchedAt = values.runtimeSecretsPatchedAt;
  }
}

async function completeWithDb(
  db: UpdateClient,
  input: Parameters<AstroSitePublishStore["complete"]>[0],
): Promise<AstroSitePublish | null> {
  const set: Partial<InsertAstroSitePublish> = {
    step: input.completion.nextStep,
    status: input.completion.nextStep === "published" ? "published" : "pending",
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    completedAt: input.completion.nextStep === "published" ? input.now : undefined,
    updatedAt: input.now,
  };
  setStepValues(set, input.completion.values);
  const rows = await db
    .update(astroSitePublishes)
    .set(set)
    .where(
      and(
        eq(astroSitePublishes.id, input.jobId),
        eq(astroSitePublishes.leaseToken, input.leaseToken),
        eq(astroSitePublishes.step, input.expectedStep),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export const astroSitePublishStore: AstroSitePublishStore = {
  async start(input) {
    return startWithDb(await requireDb(), input);
  },

  async get(clientId) {
    return getWithDb(await requireDb(), clientId);
  },

  async claim(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePublishes)
      .set({
        status: "running",
        leaseToken: input.leaseToken,
        leaseUntil: input.leaseUntil,
        lastError: null,
        attemptCount: sql<number>`${astroSitePublishes.attemptCount} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(astroSitePublishes.clientId, input.clientId),
          input.allowFailed
            ? ne(astroSitePublishes.status, "published")
            : or(
                eq(astroSitePublishes.status, "pending"),
                eq(astroSitePublishes.status, "running"),
              ),
          or(
            isNull(astroSitePublishes.leaseUntil),
            lt(astroSitePublishes.leaseUntil, input.now),
          ),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async markRepositoryCreateRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePublishes)
      .set({ repositoryCreateRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(astroSitePublishes.id, input.jobId),
          eq(astroSitePublishes.leaseToken, input.leaseToken),
          eq(astroSitePublishes.step, "create_repository"),
          isNull(astroSitePublishes.repositoryCreateRequestedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async markDispatchRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePublishes)
      .set({ dispatchRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(astroSitePublishes.id, input.jobId),
          eq(astroSitePublishes.leaseToken, input.leaseToken),
          eq(astroSitePublishes.step, "dispatch_workflow"),
          isNull(astroSitePublishes.dispatchRequestedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async complete(input) {
    const db = await requireDb();
    if (input.completion.nextStep !== "published") {
      return completeWithDb(db, input);
    }
    return db.transaction(async transaction => {
      const published = await completeWithDb(transaction, input);
      if (!published) return null;
      await transaction
        .update(clients)
        .set({ status: "live", updatedAt: input.now })
        .where(eq(clients.id, published.clientId));
      return published;
    });
  },

  async fail(input) {
    const db = await requireDb();
    const set: Partial<InsertAstroSitePublish> = {
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: input.message,
      updatedAt: input.now,
    };
    if (input.resumeStep) set.step = input.resumeStep;
    setStepValues(set, input.values);
    const rows = await db
      .update(astroSitePublishes)
      .set(set)
      .where(
        and(
          eq(astroSitePublishes.id, input.jobId),
          eq(astroSitePublishes.leaseToken, input.leaseToken),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
};
