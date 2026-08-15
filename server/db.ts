import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Client,
  ClientAsset,
  ClientSecretSetup,
  InsertClient,
  InsertClientAsset,
  InsertClientSecretSetup,
  InsertUser,
  clientAssets,
  clientSecretSetups,
  clients,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { UpdateConflictError } from "./trpcErrors";
import { seedWorkspaceDefaults, type WorkspaceSeedClient } from "./workspaceSeed";
import { CLOSED_BUSINESS_HOURS, sanitizeClientFolder } from "../shared/client";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available.");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function listClients(): Promise<Client[]> {
  const db = await requireDb();
  return db.select().from(clients).orderBy(desc(clients.updatedAt));
}

export async function getClientById(clientId: number): Promise<Client | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0];
}

export async function createClient(values: InsertClient): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(clients).values(values).$returningId();
  const created = result[0];
  if (!created?.id) throw new Error("Client could not be created.");
  return created.id;
}

export function mysqlAffectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (header && typeof header === "object" && "affectedRows" in header) {
    const value = header.affectedRows;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

export function resolveOptimisticUpdate(affectedRows: number, existing: { id: number } | undefined): void {
  if (affectedRows > 0) return;
  if (!existing) throw new Error("Client not found.");
  throw new UpdateConflictError();
}

export async function updateClient(
  clientId: number,
  values: Partial<InsertClient>,
  expectedUpdatedAt: Date,
): Promise<void> {
  const db = await requireDb();
  const result = await db
    .update(clients)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.updatedAt, expectedUpdatedAt)));
  if (mysqlAffectedRows(result) > 0) return;
  resolveOptimisticUpdate(0, await getClientById(clientId));
}

export async function listClientAssets(): Promise<ClientAsset[]> {
  const db = await requireDb();
  return db.select().from(clientAssets);
}

export async function listClientSecretSetups(): Promise<ClientSecretSetup[]> {
  const db = await requireDb();
  return db.select().from(clientSecretSetups);
}

export async function getClientAssets(clientId: number): Promise<ClientAsset[]> {
  const db = await requireDb();
  return db.select().from(clientAssets).where(eq(clientAssets.clientId, clientId));
}

export async function createClientWithSecretsInTransaction(
  tx: WorkspaceSeedClient,
  values: InsertClient,
  secretValues: Partial<Omit<InsertClientSecretSetup, "clientId">>,
): Promise<number> {
  const result = await tx.insert(clients).values(values).$returningId();
  const clientId = result[0]?.id;
  if (!clientId) throw new Error("Client could not be created.");
  if (Object.keys(secretValues).length > 0) {
    await tx
      .insert(clientSecretSetups)
      .values({ clientId, ...secretValues })
      .onDuplicateKeyUpdate({ set: secretValues });
  }
  await seedWorkspaceDefaults(tx, clientId);
  return clientId;
}

export async function createClientWithSecrets(
  values: InsertClient,
  secretValues: Partial<Omit<InsertClientSecretSetup, "clientId">>,
): Promise<number> {
  const db = await requireDb();
  return db.transaction(tx => createClientWithSecretsInTransaction(tx, values, secretValues));
}

export async function upsertClientAsset(values: InsertClientAsset): Promise<void> {
  const db = await requireDb();
  await db
    .insert(clientAssets)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        storageKey: values.storageKey,
        storageUrl: values.storageUrl,
        filename: values.filename,
        originalFilename: values.originalFilename,
        mimeType: values.mimeType,
        byteSize: values.byteSize,
        width: values.width,
        height: values.height,
      },
    });
}

export async function getClientSecretSetup(
  clientId: number,
): Promise<ClientSecretSetup | undefined> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(clientSecretSetups)
    .where(eq(clientSecretSetups.clientId, clientId))
    .limit(1);
  return rows[0];
}

export async function saveClientSecretSetup(
  clientId: number,
  values: Partial<Omit<InsertClientSecretSetup, "clientId">>,
): Promise<void> {
  const db = await requireDb();
  await db
    .insert(clientSecretSetups)
    .values({ clientId, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

export async function listClientShortNames(): Promise<string[]> {
  const db = await requireDb();
  const rows = await db.select({ shortName: clients.shortName }).from(clients);
  return rows.map(row => row.shortName);
}

export async function allocateUniqueShortName(businessName: string): Promise<string> {
  const used = new Set((await listClientShortNames()).map(name => name.toLowerCase()));
  const base =
    sanitizeClientFolder(businessName).slice(0, 80) ||
    "client";
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (true) {
    const token = `-${suffix}`;
    const candidate = `${base.slice(0, Math.max(1, 80 - token.length))}${token}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
    suffix += 1;
  }
}

export async function createDraftClient(businessName: string): Promise<number> {
  const shortName = await allocateUniqueShortName(businessName);
  return createClient({
    businessName: businessName.trim(),
    shortName,
    country: "US",
    theme: "aqua",
    businessHours: CLOSED_BUSINESS_HOURS,
    productCategories: [],
    status: "draft",
  });
}
