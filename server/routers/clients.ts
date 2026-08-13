import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClientSecretSetup } from "../../drizzle/schema";
import {
  ASSET_SLOT_FILENAMES,
  ASSET_SLOT_VALUES,
  SECRET_FIELD_VALUES,
  buildReadiness,
  clientInputSchema,
  emptySecretStatus,
  isAssetSlot,
  sanitizeClientFolder,
  secretSetupInputSchema,
  type ClientInput,
  type SecretSetupInput,
  type SecretStatus,
} from "../../shared/client";
import {
  createClient,
  getClientAssets,
  getClientById,
  getClientSecretSetup,
  listClients,
  saveClientSecretSetup,
  updateClient,
  upsertClientAsset,
} from "../db";
import { encryptSetupValue, hasProtectedValue } from "../clientSecurity";
import { decodeImageDataUrl, processUploadedImage } from "../imageProcessing";
import { storagePutExact } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { ensureWorkspaceDefaults } from "../workspaceDb";

const secretColumnByField = {
  metaPixelId: "metaPixelIdEncrypted",
  ga4MeasurementId: "ga4MeasurementIdEncrypted",
  clarityId: "clarityIdEncrypted",
  ghlApiKey: "ghlApiKeyEncrypted",
  ghlWebhookUrl: "ghlWebhookUrlEncrypted",
  cloudflareProjectName: "cloudflareProjectNameEncrypted",
} as const;

function secretStatusFromRow(row: ClientSecretSetup | undefined): SecretStatus {
  if (!row) return emptySecretStatus();
  return {
    metaPixelId: hasProtectedValue(row.metaPixelIdEncrypted),
    ga4MeasurementId: hasProtectedValue(row.ga4MeasurementIdEncrypted),
    clarityId: hasProtectedValue(row.clarityIdEncrypted),
    ghlApiKey: hasProtectedValue(row.ghlApiKeyEncrypted),
    ghlWebhookUrl: hasProtectedValue(row.ghlWebhookUrlEncrypted),
    cloudflareProjectName: hasProtectedValue(row.cloudflareProjectNameEncrypted),
  };
}

async function applySetupValues(clientId: number, input: SecretSetupInput): Promise<void> {
  const encryptedUpdates: Record<string, string> = {};

  for (const field of SECRET_FIELD_VALUES) {
    const value = input[field]?.trim();
    if (!value) continue;
    encryptedUpdates[secretColumnByField[field]] = encryptSetupValue(value);
  }

  if (Object.keys(encryptedUpdates).length > 0) {
    await saveClientSecretSetup(clientId, encryptedUpdates);
  }
}

function duplicateShortName(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ER_DUP_ENTRY",
  );
}

export async function getClientView(clientId: number) {
  const [client, assets, secretRow] = await Promise.all([
    getClientById(clientId),
    getClientAssets(clientId),
    getClientSecretSetup(clientId),
  ]);

  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

  const secretStatus = secretStatusFromRow(secretRow);
  const readiness = buildReadiness(
    client as unknown as ClientInput,
    assets.map(asset => asset.slot).filter(isAssetSlot),
    secretStatus,
  );

  return { client, assets, secretStatus, readiness };
}

export const clientsRouter = router({
  list: protectedProcedure.query(async () => {
    const rows = await listClients();
    return Promise.all(rows.map(row => getClientView(row.id)));
  }),

  get: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(({ input }) => getClientView(input.clientId)),

  create: protectedProcedure
    .input(z.object({ details: clientInputSchema, setup: secretSetupInputSchema }))
    .mutation(async ({ input }) => {
      try {
        const clientId = await createClient({ ...input.details, status: "draft" });
        await applySetupValues(clientId, input.setup);
        await ensureWorkspaceDefaults(clientId);
        return getClientView(clientId);
      } catch (error) {
        if (duplicateShortName(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That short name is already used. Choose a different one.",
          });
        }
        throw error;
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        details: clientInputSchema,
        setup: secretSetupInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await getClientById(input.clientId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      try {
        await updateClient(input.clientId, input.details);
        await applySetupValues(input.clientId, input.setup);
        return getClientView(input.clientId);
      } catch (error) {
        if (duplicateShortName(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That short name is already used. Choose a different one.",
          });
        }
        throw error;
      }
    }),

  uploadAsset: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        slot: z.enum(ASSET_SLOT_VALUES),
        originalFilename: z.string().trim().min(1).max(500),
        dataUrl: z.string().min(20).max(30_000_000),
      }),
    )
    .mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      try {
        const decoded = decodeImageDataUrl(input.dataUrl);
        const processed = await processUploadedImage(decoded.buffer, input.slot);
        const folder = sanitizeClientFolder(client.shortName) || `client-${client.id}`;
        const filename = ASSET_SLOT_FILENAMES[input.slot];
        const stored = await storagePutExact(
          `clients/${client.id}-${folder}/${filename}`,
          processed.buffer,
          processed.mimeType,
        );

        await upsertClientAsset({
          clientId: client.id,
          slot: input.slot,
          storageKey: stored.key,
          storageUrl: stored.url,
          filename,
          originalFilename: input.originalFilename,
          mimeType: processed.mimeType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
        });

        return getClientView(client.id);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "That image could not be uploaded.",
        });
      }
    }),

  launch: adminProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const view = await getClientView(input.clientId);
      if (!view.readiness.isComplete) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Complete every checklist item before launching this client.",
        });
      }

      await updateClient(input.clientId, { status: "ready", readyAt: new Date() });
      return getClientView(input.clientId);
    }),
});
