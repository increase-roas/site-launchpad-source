import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  Client,
  ClientAsset,
  ClientSecretSetup,
  InsertClient,
  InsertClientSecretSetup,
  InsertUser,
  User,
  clientAssets,
  clientSecretSetups,
  clients,
  users,
} from "../drizzle/schema";
import { CLOSED_BUSINESS_HOURS, sanitizeClientFolder } from "../shared/client";
import {
  postgresConflictTargets,
  requireSinglePositiveId,
  withUpdatedAt,
} from "./postgresPersistence";
import { classifyRuntimeError } from "./_core/operationTelemetry";
import { UpdateConflictError } from "./trpcErrors";
import { seedWorkspaceDefaults, type WorkspaceSeedClient } from "./workspaceSeed";

type Database = ReturnType<typeof drizzle>;
type DatabaseClient = ReturnType<typeof postgres>;

type DatabaseRuntime = {
  client: DatabaseClient;
  db: Database;
};

let databaseRuntime: DatabaseRuntime | null = null;

export const POSTGRES_RUNTIME_OPTIONS = {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 1_800,
  connection: {
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 30_000,
  },
} as const;

export const DATABASE_OPERATION_TIMEOUT_MS = 20_000;

export class DatabaseOperationTimeoutError extends Error {
  readonly code = "DATABASE_OPERATION_TIMEOUT";

  constructor(readonly operation: string) {
    super("The database operation exceeded its deadline.");
    this.name = "DatabaseOperationTimeoutError";
  }
}

function getDatabaseRuntime(): DatabaseRuntime | null {
  if (!databaseRuntime && process.env.DATABASE_URL) {
    const client = postgres(
      process.env.DATABASE_URL,
      POSTGRES_RUNTIME_OPTIONS,
    );
    databaseRuntime = {
      client,
      db: drizzle(client),
    };
  }
  return databaseRuntime;
}

async function discardDatabaseRuntime(runtime: DatabaseRuntime): Promise<void> {
  if (databaseRuntime !== runtime) {
    return;
  }
  databaseRuntime = null;
  try {
    await runtime.client.end({ timeout: 0 });
  } catch (error) {
    console.error("[DatabaseRuntime]", {
      outcome: "close_failure",
      classification: classifyRuntimeError(error),
    });
  }
}

async function runDatabaseOperation<T>(
  operationName: string,
  operation: (database: Database) => Promise<T>,
): Promise<T> {
  const runtime = getDatabaseRuntime();
  if (!runtime) {
    throw new Error("Database is not available.");
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new DatabaseOperationTimeoutError(operationName));
    }, DATABASE_OPERATION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(runtime.db)),
      deadline,
    ]);
  } catch (error) {
    if (error instanceof DatabaseOperationTimeoutError) {
      await discardDatabaseRuntime(runtime);
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  return getDatabaseRuntime()?.db ?? null;
}

export type UserSyncInput = Pick<
  InsertUser,
  "authUserId" | "email" | "name" | "loginMethod" | "role" | "lastSignedIn"
> & {
  authUserId: string;
  email: string;
  loginMethod: "google";
  role: "user" | "admin";
  lastSignedIn: Date;
};

export type UserPersistenceDatabase = Pick<
  ReturnType<typeof drizzle>,
  "insert"
>;

export async function upsertUserWithDb(
  db: UserPersistenceDatabase,
  user: UserSyncInput,
): Promise<User> {
  const updateSet = {
    name: user.name ?? null,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    lastSignedIn: user.lastSignedIn,
  };
  const rows = await db
    .insert(users)
    .values({
      authUserId: user.authUserId,
      ...updateSet,
    })
    .onConflictDoUpdate({
      target: postgresConflictTargets.users,
      set: withUpdatedAt(updateSet),
    })
    .returning();

  const synchronizedUser = rows[0];
  if (!synchronizedUser || rows.length !== 1) {
    throw new Error("Authenticated user could not be synchronized.");
  }
  return synchronizedUser;
}

export async function upsertUser(user: UserSyncInput): Promise<User> {
  return runDatabaseOperation("user_synchronization", database =>
    upsertUserWithDb(database, user),
  );
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function listClients(): Promise<Client[]> {
  return runDatabaseOperation("clients_list_database", database =>
    database.select().from(clients).orderBy(desc(clients.updatedAt)),
  );
}

export async function getClientById(clientId: number): Promise<Client | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0];
}

export async function createClient(values: InsertClient): Promise<number> {
  const db = await requireDb();
  const rows = await db.insert(clients).values(values).returning({ id: clients.id });
  return requireSinglePositiveId(rows, "Client could not be created.");
}

export function resolveOptimisticUpdate(
  returnedRows: readonly { id: number }[],
  existing: { id: number } | undefined,
): void {
  if (returnedRows.length > 0) return;
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
    .set(withUpdatedAt(values))
    .where(and(eq(clients.id, clientId), eq(clients.updatedAt, expectedUpdatedAt)))
    .returning({ id: clients.id });
  if (result.length > 0) return;
  resolveOptimisticUpdate(result, await getClientById(clientId));
}

export async function listClientAssets(): Promise<ClientAsset[]> {
  return runDatabaseOperation("clients_list_database", database =>
    database.select().from(clientAssets),
  );
}

export async function listClientSecretSetups(): Promise<ClientSecretSetup[]> {
  return runDatabaseOperation("clients_list_database", database =>
    database.select().from(clientSecretSetups),
  );
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
  const result = await tx.insert(clients).values(values).returning({ id: clients.id });
  const clientId = requireSinglePositiveId(result, "Client could not be created.");
  if (Object.keys(secretValues).length > 0) {
    await tx
      .insert(clientSecretSetups)
      .values({ clientId, ...secretValues })
      .onConflictDoUpdate({
        target: postgresConflictTargets.clientSecretSetups,
        set: withUpdatedAt(secretValues),
      });
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
    .onConflictDoUpdate({
      target: postgresConflictTargets.clientSecretSetups,
      set: withUpdatedAt(values),
    });
}

export async function listClientShortNames(): Promise<string[]> {
  const db = await requireDb();
  return listClientShortNamesWithDb(db);
}

async function listClientShortNamesWithDb(db: WorkspaceSeedClient): Promise<string[]> {
  const rows = await db.select({ shortName: clients.shortName }).from(clients);
  return rows.map(row => row.shortName);
}

async function allocateUniqueShortNameWithDb(
  db: WorkspaceSeedClient,
  businessName: string,
): Promise<string> {
  const used = new Set(
    (await listClientShortNamesWithDb(db)).map(name => name.toLowerCase()),
  );
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

export async function allocateUniqueShortName(businessName: string): Promise<string> {
  const db = await requireDb();
  return allocateUniqueShortNameWithDb(db, businessName);
}

export async function createDraftClientInTransaction(
  transaction: WorkspaceSeedClient,
  businessName: string,
): Promise<number> {
  const shortName = await allocateUniqueShortNameWithDb(transaction, businessName);
  return createClientWithSecretsInTransaction(
    transaction,
    {
      businessName: businessName.trim(),
      shortName,
      country: "US",
      theme: "aqua",
      businessHours: CLOSED_BUSINESS_HOURS,
      productCategories: [],
      status: "draft",
    },
    {},
  );
}

type DraftClientDatabase = Pick<ReturnType<typeof drizzle>, "transaction">;

export async function createDraftClientWithDb(
  db: DraftClientDatabase,
  businessName: string,
): Promise<number> {
  return db.transaction(transaction =>
    createDraftClientInTransaction(transaction, businessName),
  );
}

export async function createDraftClient(businessName: string): Promise<number> {
  const db = await requireDb();
  return createDraftClientWithDb(db, businessName);
}
