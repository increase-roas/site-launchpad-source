import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  astroSitePreviews,
  type AstroSitePreview,
  type InsertAstroSitePreview,
} from "../../drizzle/schema";
import type {
  AstroSitePreviewErrorCode,
  AstroSitePreviewStep,
  PreviewValidationIssue,
} from "../../shared/astroSitePreview";
import { getDb } from "../db";
import type { AstroSitePreviewStepValues, AstroSitePreviewStore } from "./previewAstroSite";

type ReadClient = Pick<PostgresJsDatabase, "select">;
type InsertClient = Pick<PostgresJsDatabase, "insert" | "select">;
type UpdateClient = Pick<PostgresJsDatabase, "update">;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

async function latestWithDb(
  db: ReadClient,
  clientId: number,
): Promise<AstroSitePreview | null> {
  const rows = await db
    .select()
    .from(astroSitePreviews)
    .where(eq(astroSitePreviews.clientId, clientId))
    .orderBy(desc(astroSitePreviews.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

function setStepValues(
  target: Partial<InsertAstroSitePreview>,
  values: AstroSitePreviewStepValues | undefined,
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
  if ("previewUrl" in values) target.previewUrl = values.previewUrl;
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
  input: Parameters<AstroSitePreviewStore["complete"]>[0],
): Promise<AstroSitePreview | null> {
  const set: Partial<InsertAstroSitePreview> = {
    step: input.completion.nextStep,
    status: input.completion.nextStep === "ready" ? "ready" : "pending",
    leaseToken: null,
    leaseUntil: null,
    lastError: null,
    errorCode: null,
    completedAt: input.completion.nextStep === "ready" ? input.now : undefined,
    updatedAt: input.now,
  };
  setStepValues(set, input.completion.values);
  const rows = await db
    .update(astroSitePreviews)
    .set(set)
    .where(
      and(
        eq(astroSitePreviews.id, input.jobId),
        eq(astroSitePreviews.leaseToken, input.leaseToken),
        eq(astroSitePreviews.step, input.expectedStep),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export const astroSitePreviewStore: AstroSitePreviewStore = {
  async start(input) {
    const db = await requireDb();
    return startWithDb(db, input);
  },

  async getLatest(clientId) {
    return latestWithDb(await requireDb(), clientId);
  },

  async getById(jobId) {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(astroSitePreviews)
      .where(eq(astroSitePreviews.id, jobId))
      .limit(1);
    return rows[0] ?? null;
  },

  async listHistory(clientId) {
    const db = await requireDb();
    return db
      .select()
      .from(astroSitePreviews)
      .where(eq(astroSitePreviews.clientId, clientId))
      .orderBy(desc(astroSitePreviews.createdAt));
  },

  async claim(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePreviews)
      .set({
        status: "running",
        leaseToken: input.leaseToken,
        leaseUntil: input.leaseUntil,
        lastError: null,
        errorCode: null,
        attemptCount: sql<number>`${astroSitePreviews.attemptCount} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(astroSitePreviews.id, input.jobId),
          input.allowFailed
            ? sql`${astroSitePreviews.status} <> 'ready'`
            : or(
                eq(astroSitePreviews.status, "pending"),
                eq(astroSitePreviews.status, "running"),
              ),
          or(
            isNull(astroSitePreviews.leaseUntil),
            lt(astroSitePreviews.leaseUntil, input.now),
          ),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async markRepositoryCreateRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePreviews)
      .set({ repositoryCreateRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(astroSitePreviews.id, input.jobId),
          eq(astroSitePreviews.leaseToken, input.leaseToken),
          eq(astroSitePreviews.step, "create_repository"),
          isNull(astroSitePreviews.repositoryCreateRequestedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async markDispatchRequested(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePreviews)
      .set({ dispatchRequestedAt: input.requestedAt, updatedAt: input.requestedAt })
      .where(
        and(
          eq(astroSitePreviews.id, input.jobId),
          eq(astroSitePreviews.leaseToken, input.leaseToken),
          eq(astroSitePreviews.step, "dispatch_workflow"),
          isNull(astroSitePreviews.dispatchRequestedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async complete(input) {
    return completeWithDb(await requireDb(), input);
  },

  async fail(input) {
    const db = await requireDb();
    const set: Partial<InsertAstroSitePreview> = {
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: input.message,
      errorCode: input.errorCode ?? null,
      updatedAt: input.now,
    };
    if (input.resumeStep) set.step = input.resumeStep;
    setStepValues(set, input.values);
    const rows = await db
      .update(astroSitePreviews)
      .set(set)
      .where(
        and(
          eq(astroSitePreviews.id, input.jobId),
          eq(astroSitePreviews.leaseToken, input.leaseToken),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async approve(input) {
    const db = await requireDb();
    const rows = await db
      .update(astroSitePreviews)
      .set({
        approvedSha: input.approvedSha,
        approvedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(astroSitePreviews.id, input.jobId),
          eq(astroSitePreviews.status, "ready"),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
};

async function startWithDb(
  db: InsertClient,
  input: Parameters<AstroSitePreviewStore["start"]>[0],
): Promise<AstroSitePreview> {
  const active = await db
    .select()
    .from(astroSitePreviews)
    .where(
      and(
        eq(astroSitePreviews.clientId, input.clientId),
        inArray(astroSitePreviews.status, ["pending", "running"]),
      ),
    )
    .limit(1);
  if (active[0]) {
    const error = new Error("A preview is already generating for this client.");
    (error as Error & { previewErrorCode?: AstroSitePreviewErrorCode }).previewErrorCode =
      "PREVIEW_ALREADY_RUNNING";
    throw error;
  }

  const inserted = await db
    .insert(astroSitePreviews)
    .values({
      clientId: input.clientId,
      externalSiteId: input.externalSiteId,
      templateKey: input.templateKey,
      templateRepo: input.templateRepo,
      contractVersion: input.contractVersion,
      templateSha: input.templateSha,
      clientRevision: input.clientRevision,
      resourceName: input.resourceName,
      repositoryName: input.repositoryName,
      workerName: input.workerName,
      d1DatabaseName: input.d1DatabaseName,
      r2BucketName: input.r2BucketName,
      materialSnapshotEncrypted: input.materialSnapshotEncrypted,
      warnings: input.warnings as PreviewValidationIssue[],
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning();
  const job = inserted[0];
  if (!job) throw new Error("Website preview job could not be started.");
  return job;
}
