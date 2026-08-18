import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  clientLeadIntegrations,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnels,
  type ClientLeadIntegration,
} from "../drizzle/schema";
import {
  SIMPLE_FORM_CLOUDFLARE_INFRA,
  SIMPLE_FORM_CLIENT_SECRET_KEYS,
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_PREVIEW,
  SIMPLE_FORM_SECRET_COLUMN,
  SIMPLE_FORM_SECRET_GUIDES,
  SIMPLE_FORM_STEPS,
  SIMPLE_FORM_TEMPLATE_KEY,
  type SimpleFormClientIntegrationFields,
  type SimpleFormClientSecretKey,
} from "../shared/simpleFormContract";
import type { SimpleFormPublishMaterial } from "./publisher/publishSimpleForm";
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
import {
  postgresConflictTargets,
  requireSinglePositiveId,
  withUpdatedAt,
} from "./postgresPersistence";
import { isDuplicateKeyError } from "./trpcErrors";
import { funnelStepRows } from "./workspaceSeed";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

function emptySecretPresence(): SimpleFormSecretPresence {
  return {
    GHL_API_KEY: false,
    META_CAPI_ACCESS_TOKEN: false,
    STAGE_WEBHOOK_SECRET: false,
    ALERT_WEBHOOK_URL: false,
  };
}

export function secretPresenceFromRow(row: ClientLeadIntegration | undefined): SimpleFormSecretPresence {
  const presence = emptySecretPresence();
  if (!row) return presence;
  for (const key of SIMPLE_FORM_CLIENT_SECRET_KEYS) {
    presence[key] = hasProtectedValue(row[SIMPLE_FORM_SECRET_COLUMN[key]]);
  }
  return presence;
}

function integrationFieldsFromRow(
  row: ClientLeadIntegration | undefined,
): SimpleFormClientIntegrationFields {
  return {
    GHL_LOCATION_ID: row?.ghlLocationId ?? null,
    GOOGLE_SHEETS_ID: row?.googleSheetsId ?? null,
    META_PIXEL_ID: row?.metaPixelId ?? null,
  };
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
  const stageWebhookSecret = generateCrmCallbackSecret();

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
        .returning({ id: funnels.id });
      const id = requireSinglePositiveId(inserted, "Funnel could not be created.");
      await transaction.insert(funnelSteps).values(funnelStepRows(id, slug, SIMPLE_FORM_STEPS));
      await transaction.insert(funnelSimpleFormConfigs).values({ funnelId: id, configJson: record });
      await transaction
        .insert(clientLeadIntegrations)
        .values({
          clientId,
          metaPixelId: record.config.meta.pixelId.trim() || null,
          stageWebhookSecretEncrypted: encryptSetupValue(stageWebhookSecret),
        })
        .onConflictDoNothing({ target: clientLeadIntegrations.clientId });
      return id;
    });
    return { alreadyExists: false as const, funnelId };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const raced = await findSimpleFormFunnel(clientId);
    if (raced) return { alreadyExists: true as const, funnelId: raced.id };
    throw error;
  }
}

function parseStoredRecord(value: Record<string, unknown>): SimpleFormStoredRecord {
  return simpleFormStoredRecordSchema.parse(value);
}

function decryptRuntimeSecret(value: string | null | undefined): string | null {
  return hasProtectedValue(value) ? decryptSetupValue(value as string) : null;
}

export async function getSimpleFormDetail(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const [configRows, integrationRows, assets, client] = await Promise.all([
    db.select().from(funnelSimpleFormConfigs).where(eq(funnelSimpleFormConfigs.funnelId, funnelId)).limit(1),
    db.select().from(clientLeadIntegrations).where(eq(clientLeadIntegrations.clientId, clientId)).limit(1),
    getClientAssets(clientId),
    getClientById(clientId),
  ]);
  if (!client) throw new Error("Client not found.");
  const stored = parseStoredRecord((configRows[0]?.configJson ?? {}) as Record<string, unknown>);
  const secrets = secretPresenceFromRow(integrationRows[0]);
  const integration = integrationFieldsFromRow(integrationRows[0]);
  const config = resolveSimpleFormImages(stored, assets);
  const record = { ...stored, config };
  const readiness = buildSimpleFormReadiness(record, secrets, integration);
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
    integration,
    secretGuides: SIMPLE_FORM_SECRET_GUIDES,
    readiness,
    template: {
      ...SIMPLE_FORM_MANIFEST,
      previewImageUrl: SIMPLE_FORM_PREVIEW.imageUrl,
      defaultLogoUrl: record.config.client.logoUrl,
    },
  };
}

type SimpleFormSaveClient = Pick<PostgresJsDatabase, "insert" | "select" | "update">;

export async function saveSimpleFormConfigInTransaction(
  transaction: SimpleFormSaveClient,
  funnel: { id: number; slug: string },
  record: SimpleFormStoredRecord,
): Promise<void> {
  await transaction
    .insert(funnelSimpleFormConfigs)
    .values({ funnelId: funnel.id, configJson: record })
    .onConflictDoUpdate({
      target: postgresConflictTargets.funnelSimpleFormConfigs,
      set: withUpdatedAt({ configJson: record }),
    });
  await transaction
    .update(funnels)
    .set(withUpdatedAt({
      name: simpleFormFunnelName(record.config.client.name),
      slug: record.config.funnel.slug,
    }))
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
      .set(withUpdatedAt({ path: nextPath }))
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

export async function saveSimpleFormIntegration(
  clientId: number,
  funnelId: number,
  input: {
    GHL_LOCATION_ID?: string;
    GOOGLE_SHEETS_ID?: string;
    META_PIXEL_ID?: string;
    GHL_API_KEY?: string;
    META_CAPI_ACCESS_TOKEN?: string;
    ALERT_WEBHOOK_URL?: string;
    clearAlertWebhookUrl?: boolean;
    regenerateStageWebhookSecret?: boolean;
  },
) {
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.templateKey !== SIMPLE_FORM_TEMPLATE_KEY) {
    throw new Error("This funnel is not a Simple Form template instance.");
  }
  const db = await requireDb();
  const existing = await db
    .select()
    .from(clientLeadIntegrations)
    .where(eq(clientLeadIntegrations.clientId, clientId))
    .limit(1);
  const updates: Partial<ClientLeadIntegration> = {};
  const assign = (key: SimpleFormClientSecretKey, value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    updates[SIMPLE_FORM_SECRET_COLUMN[key]] = encryptSetupValue(trimmed);
  };
  if (input.GHL_LOCATION_ID !== undefined) updates.ghlLocationId = input.GHL_LOCATION_ID.trim() || null;
  if (input.GOOGLE_SHEETS_ID !== undefined) updates.googleSheetsId = input.GOOGLE_SHEETS_ID.trim() || null;
  if (input.META_PIXEL_ID !== undefined) updates.metaPixelId = input.META_PIXEL_ID.trim() || null;
  assign("GHL_API_KEY", input.GHL_API_KEY);
  assign("META_CAPI_ACCESS_TOKEN", input.META_CAPI_ACCESS_TOKEN);
  assign("ALERT_WEBHOOK_URL", input.ALERT_WEBHOOK_URL);
  if (input.clearAlertWebhookUrl) updates.alertWebhookUrlEncrypted = null;
  if (input.regenerateStageWebhookSecret || !existing[0]) {
    updates.stageWebhookSecretEncrypted = encryptSetupValue(generateCrmCallbackSecret());
  }
  if (Object.keys(updates).length > 0) {
    await db
      .insert(clientLeadIntegrations)
      .values({ clientId, ...updates })
      .onConflictDoUpdate({
        target: postgresConflictTargets.clientLeadIntegrations,
        set: withUpdatedAt(updates),
      });
  }
  return getSimpleFormDetail(clientId, funnelId);
}

export async function getSimpleFormPublishHandoff(clientId: number, funnelId: number) {
  const detail = await getSimpleFormDetail(clientId, funnelId);
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found.");
  const validatedConfiguration = buildSimpleFormValidatedConfiguration(detail.config);
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
    clientIntegration: detail.integration,
    requiredCloudflareInfrastructure: SIMPLE_FORM_CLOUDFLARE_INFRA,
    validatedConfiguration: configurationReady ? validatedConfiguration : null,
    missing: detail.readiness.sections.flatMap(section => section.missing),
  };
}

export async function getSimpleFormPublishMaterial(input: {
  clientId: number;
  funnelId: number;
}): Promise<SimpleFormPublishMaterial> {
  const detail = await getSimpleFormDetail(input.clientId, input.funnelId);
  if (!detail.readiness.configurationReady) {
    throw new Error("Complete Simple Form readiness before publishing.");
  }
  const db = await requireDb();
  const rows = await db
    .select()
    .from(clientLeadIntegrations)
    .where(eq(clientLeadIntegrations.clientId, input.clientId))
    .limit(1);
  const secrets = rows[0];
  if (!secrets) throw new Error("Simple Form runtime secrets are missing.");
  return {
    config: detail.config,
    runtimeSecrets: {
      GHL_API_KEY: decryptRuntimeSecret(secrets.ghlApiKeyEncrypted),
      GHL_LOCATION_ID: secrets.ghlLocationId,
      GOOGLE_SHEETS_ID: secrets.googleSheetsId,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      META_PIXEL_ID: secrets.metaPixelId,
      META_CAPI_ACCESS_TOKEN: decryptRuntimeSecret(
        secrets.metaCapiAccessTokenEncrypted,
      ),
      STAGE_WEBHOOK_SECRET: decryptRuntimeSecret(
        secrets.stageWebhookSecretEncrypted,
      ),
      ALERT_WEBHOOK_URL: decryptRuntimeSecret(
        secrets.alertWebhookUrlEncrypted,
      ),
    },
  };
}
