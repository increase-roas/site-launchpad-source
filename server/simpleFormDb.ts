import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnels,
  type FunnelRuntimeSecret,
} from "../drizzle/schema";
import {
  SIMPLE_FORM_CLOUDFLARE_INFRA,
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_PREVIEW,
  SIMPLE_FORM_SECRET_COLUMN,
  SIMPLE_FORM_SECRET_GUIDES,
  SIMPLE_FORM_STEPS,
  SIMPLE_FORM_TEMPLATE_KEY,
  type SimpleFormRuntimeSecretKey,
} from "../shared/simpleFormContract";
import {
  buildSimpleFormValidatedConfiguration,
  buildSimpleFormReadiness,
  buildSimpleFormStoredRecord,
  resolveSimpleFormImages,
  simpleFormFunnelName,
  simpleFormFunnelSlug,
  simpleFormOperatorConfigSchema,
  simpleFormStoredRecordSchema,
  type SimpleFormSecretPresence,
  type SimpleFormStoredRecord,
} from "../shared/simpleFormConfig";
import { encryptSetupValue, generateCrmCallbackSecret, hasProtectedValue, decryptSetupValue } from "./clientSecurity";
import { getClientAssets, getClientById, getDb } from "./db";
import { funnelStepRows } from "./workspaceSeed";

/** Website wrangler rows keep older names. Funnel secrets use the Simple Form contract names:
 * STAGE_WEBHOOK_SECRET -> CRM_CALLBACK_SECRET
 * ALERT_WEBHOOK_URL -> SUBMISSION_ALERT_WEBHOOK_URL
 */

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

function emptySecretPresence(): SimpleFormSecretPresence {
  return {
    META_CAPI_ACCESS_TOKEN: false,
    META_TEST_EVENT_CODE: false,
    GHL_WEBHOOK_URL: false,
    CRM_CALLBACK_SECRET: false,
    SUBMISSION_ALERT_WEBHOOK_URL: false,
  };
}

export function secretPresenceFromRow(row: FunnelRuntimeSecret | undefined): SimpleFormSecretPresence {
  const presence = emptySecretPresence();
  if (!row) return presence;
  for (const key of Object.keys(SIMPLE_FORM_SECRET_COLUMN) as SimpleFormRuntimeSecretKey[]) {
    presence[key] = hasProtectedValue(row[SIMPLE_FORM_SECRET_COLUMN[key]]);
  }
  return presence;
}

async function getOwnedFunnel(clientId: number, funnelId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, funnelId), eq(funnels.clientId, clientId)))
    .limit(1);
  const funnel = rows[0];
  if (!funnel) throw new Error("Funnel not found.");
  return funnel;
}

export async function listApprovedFunnelTemplates(clientId: number) {
  const db = await requireDb();
  const existing = await db
    .select({ id: funnels.id })
    .from(funnels)
    .where(and(eq(funnels.clientId, clientId), eq(funnels.templateKey, SIMPLE_FORM_TEMPLATE_KEY)))
    .limit(1);
  return [
    {
      ...SIMPLE_FORM_MANIFEST,
      ...SIMPLE_FORM_PREVIEW,
      previewImageUrl: SIMPLE_FORM_PREVIEW.imageUrl,
      existingFunnelId: existing[0]?.id ?? null,
    },
  ];
}

export async function findSimpleFormFunnel(clientId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.clientId, clientId), eq(funnels.templateKey, SIMPLE_FORM_TEMPLATE_KEY)))
    .limit(1);
  return rows[0];
}

export async function createSimpleFormFromTemplate(clientId: number) {
  const existing = await findSimpleFormFunnel(clientId);
  if (existing) {
    return { alreadyExists: true as const, funnelId: existing.id };
  }

  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");

  const db = await requireDb();
  const used = await db.select({ slug: funnels.slug }).from(funnels).where(eq(funnels.clientId, clientId));
  const slug = simpleFormFunnelSlug(client.shortName, used.map(row => row.slug));
  const name = simpleFormFunnelName(client.businessName);
  const record = buildSimpleFormStoredRecord({
    businessName: client.businessName,
    slug,
    phone: client.phone,
  });
  const crmSecret = generateCrmCallbackSecret();

  try {
    const funnelId = await db.transaction(async transaction => {
      const inserted = await transaction
        .insert(funnels)
        .values({
          clientId,
          name,
          slug,
          templateKey: SIMPLE_FORM_MANIFEST.templateKey,
          templateRepo: SIMPLE_FORM_MANIFEST.repo,
          contractVersion: SIMPLE_FORM_MANIFEST.contractVersion,
          shape: SIMPLE_FORM_MANIFEST.shape,
          status: "draft",
          deploymentStatus: "draft",
        })
        .$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new Error("Funnel could not be created.");
      await transaction.insert(funnelSteps).values(funnelStepRows(id, slug, SIMPLE_FORM_STEPS));
      await transaction.insert(funnelSimpleFormConfigs).values({ funnelId: id, configJson: record });
      await transaction.insert(funnelRuntimeSecrets).values({
        funnelId: id,
        crmCallbackSecretEncrypted: encryptSetupValue(crmSecret),
      });
      return id;
    });
    return { alreadyExists: false as const, funnelId };
  } catch (error) {
    const raced = await findSimpleFormFunnel(clientId);
    if (raced) return { alreadyExists: true as const, funnelId: raced.id };
    throw error;
  }
}

function parseStoredRecord(value: Record<string, unknown>): SimpleFormStoredRecord {
  return simpleFormStoredRecordSchema.parse(value);
}

function decryptedGhlWebhookUrl(row: FunnelRuntimeSecret | undefined): string | null {
  const encrypted = row?.ghlWebhookUrlEncrypted;
  return hasProtectedValue(encrypted) ? decryptSetupValue(encrypted as string) : null;
}

export async function getSimpleFormDetail(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const [configRows, secretRows, assets, client] = await Promise.all([
    db.select().from(funnelSimpleFormConfigs).where(eq(funnelSimpleFormConfigs.funnelId, funnelId)).limit(1),
    db.select().from(funnelRuntimeSecrets).where(eq(funnelRuntimeSecrets.funnelId, funnelId)).limit(1),
    getClientAssets(clientId),
    getClientById(clientId),
  ]);
  if (!client) throw new Error("Client not found.");
  const stored = parseStoredRecord((configRows[0]?.configJson ?? {}) as Record<string, unknown>);
  const secrets = secretPresenceFromRow(secretRows[0]);
  const config = resolveSimpleFormImages(stored, assets);
  const record = { ...stored, config };
  const readiness = buildSimpleFormReadiness(record, secrets, {
    GHL_WEBHOOK_URL: decryptedGhlWebhookUrl(secretRows[0]),
  });
  return {
    funnel: {
      id: funnel.id,
      clientId: funnel.clientId,
      name: funnel.name,
      slug: funnel.slug,
      templateKey: funnel.templateKey,
      templateRepo: funnel.templateRepo,
      contractVersion: funnel.contractVersion,
      shape: funnel.shape,
      deploymentStatus: funnel.deploymentStatus,
      status: funnel.status,
    },
    record,
    config,
    imageSources: stored.imageSources,
    assets: assets.map(asset => ({
      slot: asset.slot,
      storageUrl: asset.storageUrl,
      filename: asset.filename,
    })),
    secretStatus: secrets,
    secretGuides: SIMPLE_FORM_SECRET_GUIDES,
    readiness,
    template: {
      ...SIMPLE_FORM_MANIFEST,
      previewImageUrl: SIMPLE_FORM_PREVIEW.imageUrl,
      defaultLogoUrl: record.config.client.logoUrl,
    },
  };
}

type SimpleFormSaveClient = Pick<MySql2Database, "insert" | "select" | "update">;

export async function saveSimpleFormConfigInTransaction(
  transaction: SimpleFormSaveClient,
  funnel: { id: number; slug: string },
  record: SimpleFormStoredRecord,
): Promise<void> {
  await transaction
    .insert(funnelSimpleFormConfigs)
    .values({ funnelId: funnel.id, configJson: record })
    .onDuplicateKeyUpdate({ set: { configJson: record } });
  await transaction
    .update(funnels)
    .set({
      name: simpleFormFunnelName(record.config.client.name),
      slug: record.config.funnel.slug,
    })
    .where(eq(funnels.id, funnel.id));
  if (funnel.slug === record.config.funnel.slug) return;

  const steps = await transaction
    .select()
    .from(funnelSteps)
    .where(eq(funnelSteps.funnelId, funnel.id));
  for (const step of steps) {
    const nextPath = step.path.startsWith(`/${funnel.slug}`)
      ? `/${record.config.funnel.slug}${step.path.slice(funnel.slug.length + 1)}`
      : step.path;
    await transaction
      .update(funnelSteps)
      .set({ path: nextPath })
      .where(eq(funnelSteps.id, step.id));
  }
}

export async function saveSimpleFormConfig(
  clientId: number,
  funnelId: number,
  recordInput: SimpleFormStoredRecord,
) {
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const record = simpleFormStoredRecordSchema.parse(recordInput);
  simpleFormOperatorConfigSchema.parse(record.config);
  const db = await requireDb();
  await db.transaction(transaction =>
    saveSimpleFormConfigInTransaction(transaction, funnel, record),
  );
  return getSimpleFormDetail(clientId, funnelId);
}

export async function saveSimpleFormSecrets(
  clientId: number,
  funnelId: number,
  input: {
    META_CAPI_ACCESS_TOKEN?: string;
    META_TEST_EVENT_CODE?: string;
    GHL_WEBHOOK_URL?: string;
    SUBMISSION_ALERT_WEBHOOK_URL?: string;
    clearMetaTestEventCode?: boolean;
    regenerateCrmCallbackSecret?: boolean;
  },
) {
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const db = await requireDb();
  const updates: Partial<FunnelRuntimeSecret> = {};
  const assign = (key: SimpleFormRuntimeSecretKey, value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    updates[SIMPLE_FORM_SECRET_COLUMN[key]] = encryptSetupValue(trimmed);
  };
  assign("META_CAPI_ACCESS_TOKEN", input.META_CAPI_ACCESS_TOKEN);
  assign("GHL_WEBHOOK_URL", input.GHL_WEBHOOK_URL);
  assign("SUBMISSION_ALERT_WEBHOOK_URL", input.SUBMISSION_ALERT_WEBHOOK_URL);
  if (input.clearMetaTestEventCode) {
    updates.metaTestEventCodeEncrypted = null;
  } else {
    assign("META_TEST_EVENT_CODE", input.META_TEST_EVENT_CODE);
  }
  if (input.regenerateCrmCallbackSecret) {
    updates.crmCallbackSecretEncrypted = encryptSetupValue(generateCrmCallbackSecret());
  }
  if (Object.keys(updates).length > 0) {
    await db
      .insert(funnelRuntimeSecrets)
      .values({ funnelId, ...updates })
      .onDuplicateKeyUpdate({ set: updates });
  }
  return getSimpleFormDetail(clientId, funnelId);
}

export async function revealCrmCallbackSecret(clientId: number, funnelId: number) {
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const db = await requireDb();
  const rows = await db
    .select()
    .from(funnelRuntimeSecrets)
    .where(eq(funnelRuntimeSecrets.funnelId, funnelId))
    .limit(1);
  const encrypted = rows[0]?.crmCallbackSecretEncrypted;
  if (!hasProtectedValue(encrypted)) {
    throw new Error("CRM Callback Secret has not been generated.");
  }
  return {
    runtimeKey: "CRM_CALLBACK_SECRET" as const,
    value: decryptSetupValue(encrypted as string),
  };
}

export async function getSimpleFormPublishHandoff(clientId: number, funnelId: number) {
  const detail = await getSimpleFormDetail(clientId, funnelId);
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const db = await requireDb();
  const secretRows = await db
    .select()
    .from(funnelRuntimeSecrets)
    .where(eq(funnelRuntimeSecrets.funnelId, funnelId))
    .limit(1);
  const validatedConfiguration = buildSimpleFormValidatedConfiguration(
    detail.config,
    { GHL_WEBHOOK_URL: decryptedGhlWebhookUrl(secretRows[0]) },
  );
  const configurationReady =
    detail.readiness.configurationReady && validatedConfiguration !== null;
  return {
    published: false as const,
    configurationReady,
    client: {
      id: client.id,
      businessName: client.businessName,
      shortName: client.shortName,
    },
    funnel: {
      id: detail.funnel.id,
      name: detail.funnel.name,
      slug: detail.funnel.slug,
    },
    templateKey: SIMPLE_FORM_MANIFEST.templateKey,
    templateRepository: SIMPLE_FORM_MANIFEST.repo,
    contractVersion: SIMPLE_FORM_MANIFEST.contractVersion,
    secretsPresent: detail.secretStatus,
    requiredCloudflareInfrastructure: SIMPLE_FORM_CLOUDFLARE_INFRA,
    validatedConfiguration: configurationReady ? validatedConfiguration : null,
    missing: detail.readiness.sections.flatMap(section => section.missing),
  };
}
