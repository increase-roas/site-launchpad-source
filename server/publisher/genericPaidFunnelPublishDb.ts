import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  genericPaidFunnelPublishes,
  paidFunnels,
  type GenericPaidFunnelPublish,
  type InsertGenericPaidFunnelPublish,
} from "../../drizzle/schema";
import { getDb } from "../db";
import type {
  GenericPaidFunnelPublishStepValues,
  GenericPaidFunnelPublishStore,
} from "./publishGenericPaidFunnel";

type ReadClient = Pick<PostgresJsDatabase, "select">;
type InsertClient = Pick<PostgresJsDatabase, "insert" | "select" | "update">;
type UpdateClient = Pick<PostgresJsDatabase, "update">;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

async function getWithDb(
  db: ReadClient,
  clientId: number,
  funnelId: number,
): Promise<GenericPaidFunnelPublish | null> {
  const rows = await db
    .select()
    .from(genericPaidFunnelPublishes)
    .where(
      and(
        eq(genericPaidFunnelPublishes.clientId, clientId),
        eq(genericPaidFunnelPublishes.funnelId, funnelId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function startWithDb(
  db: InsertClient,
  input: Parameters<GenericPaidFunnelPublishStore["start"]>[0],
): Promise<GenericPaidFunnelPublish> {
  const inserted = await db
    .insert(genericPaidFunnelPublishes)
    .values({
      clientId: input.clientId,
      funnelId: input.funnelId,
      externalFunnelId: input.externalFunnelId,
      templateKey: input.templateKey,
      templateVersion: input.templateVersion,
      resourceName: input.resourceName,
      repositoryName: input.repositoryName,
      workerName: input.workerName,
      resourceDefinitions: input.resourceDefinitions,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({ target: genericPaidFunnelPublishes.funnelId })
    .returning();
  let job = inserted[0] ?? (await getWithDb(db, input.clientId, input.funnelId));
  if (!job) throw new Error("Paid funnel publish job could not be started.");
  if (
    job.clientId !== input.clientId ||
    job.templateKey !== input.templateKey ||
    job.templateVersion !== input.templateVersion ||
    !sameJson(job.resourceDefinitions, input.resourceDefinitions)
  ) {
    throw new Error(
      "Existing paid funnel publish job uses a different template contract; manual attention is required.",
    );
  }
  if (job.status !== "published") return job;

  const restarted = await db
    .update(genericPaidFunnelPublishes)
    .set({
      releaseNumber: sql<number>`${genericPaidFunnelPublishes.releaseNumber} + 1`,
      step: "commit_source",
      status: "pending",
      commitSha: null,
      dispatchRequestedAt: null,
      workflowRunId: null,
      workflowStatus: null,
      workflowCheckedAt: null,
      runtimeSecretsPatchedAt: null,
      leaseToken: null,
      leaseUntil: null,
      lastError: null,
      completedAt: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(genericPaidFunnelPublishes.id, job.id),
        eq(genericPaidFunnelPublishes.status, "published"),
      ),
    )
    .returning();
  job = restarted[0] ?? (await getWithDb(db, input.clientId, input.funnelId)) ?? job;
  return job;
}

function setStepValues(
  target: Partial<InsertGenericPaidFunnelPublish>,
  values: GenericPaidFunnelPublishStepValues | undefined,
): void {
  if (!values) return;
  for (const key of [
    "repositoryId",
    "repositoryFullName",
    "repositoryUrl",
    "defaultBranch",
    "provisionedResources",
    "commitSha",
    "liveUrl",
    "dispatchRequestedAt",
    "workflowRunId",
    "workflowStatus",
    "workflowCheckedAt",
    "runtimeSecretsPatchedAt",
  ] as const) {
    if (key in values) target[key] = values[key] as never;
  }
}

async function completeWithDb(
  db: UpdateClient,
  input: Parameters<GenericPaidFunnelPublishStore["complete"]>[0],
): Promise<GenericPaidFunnelPublish | null> {
  const set: Partial<InsertGenericPaidFunnelPublish> = {
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
    .update(genericPaidFunnelPublishes)
    .set(set)
    .where(
      and(
        eq(genericPaidFunnelPublishes.id, input.jobId),
        eq(genericPaidFunnelPublishes.leaseToken, input.leaseToken),
        eq(genericPaidFunnelPublishes.step, input.expectedStep),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export const genericPaidFunnelPublishStore: GenericPaidFunnelPublishStore = {
  async start(input) {
    return startWithDb(await requireDb(), input);
  },
  async get(clientId, funnelId) {
    return getWithDb(await requireDb(), clientId, funnelId);
  },
  async claim(input) {
    const db = await requireDb();
    const rows = await db
      .update(genericPaidFunnelPublishes)
      .set({
        status: "running",
        leaseToken: input.leaseToken,
        leaseUntil: input.leaseUntil,
        lastError: null,
        attemptCount: sql<number>`${genericPaidFunnelPublishes.attemptCount} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(genericPaidFunnelPublishes.clientId, input.clientId),
          eq(genericPaidFunnelPublishes.funnelId, input.funnelId),
          input.allowFailed
            ? ne(genericPaidFunnelPublishes.status, "published")
            : or(
                eq(genericPaidFunnelPublishes.status, "pending"),
                eq(genericPaidFunnelPublishes.status, "running"),
              ),
          or(
            isNull(genericPaidFunnelPublishes.leaseUntil),
            lt(genericPaidFunnelPublishes.leaseUntil, input.now),
          ),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
  async markRepositoryCreateRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(genericPaidFunnelPublishes)
      .set({ repositoryCreateRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(genericPaidFunnelPublishes.id, input.jobId),
          eq(genericPaidFunnelPublishes.leaseToken, input.leaseToken),
          eq(genericPaidFunnelPublishes.step, "create_repository"),
          isNull(genericPaidFunnelPublishes.repositoryCreateRequestedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
  async markDispatchRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(genericPaidFunnelPublishes)
      .set({ dispatchRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(genericPaidFunnelPublishes.id, input.jobId),
          eq(genericPaidFunnelPublishes.leaseToken, input.leaseToken),
          eq(genericPaidFunnelPublishes.step, "dispatch_workflow"),
          isNull(genericPaidFunnelPublishes.dispatchRequestedAt),
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
        .update(paidFunnels)
        .set({ status: "live", updatedAt: input.now })
        .where(eq(paidFunnels.id, published.funnelId));
      return published;
    });
  },
  async fail(input) {
    const db = await requireDb();
    const set: Partial<InsertGenericPaidFunnelPublish> = {
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: input.message,
      updatedAt: input.now,
    };
    if (input.resumeStep) set.step = input.resumeStep;
    setStepValues(set, input.values);
    const rows = await db
      .update(genericPaidFunnelPublishes)
      .set(set)
      .where(
        and(
          eq(genericPaidFunnelPublishes.id, input.jobId),
          eq(genericPaidFunnelPublishes.leaseToken, input.leaseToken),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
};
