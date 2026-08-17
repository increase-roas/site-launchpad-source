import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  funnelPublishes,
  funnels,
  type FunnelPublish,
  type InsertFunnelPublish,
} from "../../drizzle/schema";
import { getDb } from "../db";
import type {
  PublishStepValues,
  SimpleFormPublishStore,
} from "./publishSimpleForm";

type PublishReadClient = Pick<PostgresJsDatabase, "select">;
type PublishInsertClient = Pick<PostgresJsDatabase, "insert" | "select">;
type PublishUpdateClient = Pick<PostgresJsDatabase, "update">;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

async function getPublishWithDb(
  db: PublishReadClient,
  clientId: number,
  funnelId: number
): Promise<FunnelPublish | null> {
  const rows = await db
    .select()
    .from(funnelPublishes)
    .where(
      and(
        eq(funnelPublishes.clientId, clientId),
        eq(funnelPublishes.funnelId, funnelId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function startPublishWithDb(
  db: PublishInsertClient,
  input: Parameters<SimpleFormPublishStore["start"]>[0]
): Promise<FunnelPublish> {
  const inserted = await db
    .insert(funnelPublishes)
    .values({
      clientId: input.clientId,
      funnelId: input.funnelId,
      externalFunnelId: input.externalFunnelId,
      resourceName: input.resourceName,
      repositoryName: input.repositoryName,
      workerName: input.workerName,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({
      target: funnelPublishes.funnelId,
    })
    .returning();
  const job =
    inserted[0] ?? (await getPublishWithDb(db, input.clientId, input.funnelId));
  if (!job) throw new Error("Publish job could not be started.");
  return job;
}

function setPublishValues(
  target: Partial<InsertFunnelPublish>,
  values: PublishStepValues | undefined
): void {
  if (!values) return;
  if ("repositoryId" in values) target.repositoryId = values.repositoryId;
  if ("repositoryFullName" in values) {
    target.repositoryFullName = values.repositoryFullName;
  }
  if ("repositoryUrl" in values) target.repositoryUrl = values.repositoryUrl;
  if ("defaultBranch" in values) target.defaultBranch = values.defaultBranch;
  if ("kvNamespaceId" in values) target.kvNamespaceId = values.kvNamespaceId;
  if ("d1DatabaseId" in values) target.d1DatabaseId = values.d1DatabaseId;
  if ("primaryQueueId" in values) target.primaryQueueId = values.primaryQueueId;
  if ("deadLetterQueueId" in values) {
    target.deadLetterQueueId = values.deadLetterQueueId;
  }
  if ("commitSha" in values) target.commitSha = values.commitSha;
  if ("liveUrl" in values) target.liveUrl = values.liveUrl;
  if ("dispatchRequestedAt" in values) {
    target.dispatchRequestedAt = values.dispatchRequestedAt;
  }
  if ("workflowRunId" in values) target.workflowRunId = values.workflowRunId;
  if ("workflowStatus" in values) {
    target.workflowStatus = values.workflowStatus;
  }
  if ("workflowCheckedAt" in values) {
    target.workflowCheckedAt = values.workflowCheckedAt;
  }
  if ("runtimeSecretsPatchedAt" in values) {
    target.runtimeSecretsPatchedAt = values.runtimeSecretsPatchedAt;
  }
}

async function completePublishWithDb(
  db: PublishUpdateClient,
  input: Parameters<SimpleFormPublishStore["complete"]>[0]
): Promise<FunnelPublish | null> {
  const set: Partial<InsertFunnelPublish> = {
    step: input.completion.nextStep,
    status: input.completion.nextStep === "published" ? "published" : "pending",
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    completedAt:
      input.completion.nextStep === "published" ? input.now : undefined,
    updatedAt: input.now,
  };
  setPublishValues(set, input.completion.values);
  const rows = await db
    .update(funnelPublishes)
    .set(set)
    .where(
      and(
        eq(funnelPublishes.id, input.jobId),
        eq(funnelPublishes.leaseToken, input.leaseToken),
        eq(funnelPublishes.step, input.expectedStep)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export const simpleFormPublishStore: SimpleFormPublishStore = {
  async start(input) {
    return startPublishWithDb(await requireDb(), input);
  },

  async get(clientId, funnelId) {
    return getPublishWithDb(await requireDb(), clientId, funnelId);
  },

  async claim(input) {
    const db = await requireDb();
    const rows = await db
      .update(funnelPublishes)
      .set({
        status: "running",
        leaseToken: input.leaseToken,
        leaseUntil: input.leaseUntil,
        lastError: null,
        attemptCount: sql<number>`${funnelPublishes.attemptCount} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(funnelPublishes.clientId, input.clientId),
          eq(funnelPublishes.funnelId, input.funnelId),
          ne(funnelPublishes.status, "published"),
          or(
            isNull(funnelPublishes.leaseUntil),
            lt(funnelPublishes.leaseUntil, input.now)
          )
        )
      )
      .returning();
    return rows[0] ?? null;
  },

  async markDispatchRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(funnelPublishes)
      .set({
        dispatchRequestedAt: input.requestedAt,
        updatedAt: input.requestedAt,
      })
      .where(
        and(
          eq(funnelPublishes.id, input.jobId),
          eq(funnelPublishes.leaseToken, input.leaseToken),
          eq(funnelPublishes.step, "dispatch_workflow")
        )
      )
      .returning();
    return rows[0] ?? null;
  },

  async complete(input) {
    const db = await requireDb();
    if (input.completion.nextStep !== "published") {
      return completePublishWithDb(db, input);
    }
    return db.transaction(async transaction => {
      const published = await completePublishWithDb(transaction, input);
      if (!published) return null;
      await transaction
        .update(funnels)
        .set({
          deploymentStatus: "deployed",
          status: "live",
          deployedAt: input.now,
          updatedAt: input.now,
        })
        .where(eq(funnels.id, published.funnelId));
      return published;
    });
  },

  async fail(input) {
    const db = await requireDb();
    const set: Partial<InsertFunnelPublish> = {
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: input.message,
      updatedAt: input.now,
    };
    if (input.resumeStep) set.step = input.resumeStep;
    setPublishValues(set, input.values);
    const rows = await db
      .update(funnelPublishes)
      .set(set)
      .where(
        and(
          eq(funnelPublishes.id, input.jobId),
          eq(funnelPublishes.leaseToken, input.leaseToken)
        )
      )
      .returning();
    return rows[0] ?? null;
  },
};
