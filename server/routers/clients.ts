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
  createClientWithSecrets,
  getClientAssets,
  getClientById,
  getClientSecretSetup,
  listClientAssets,
  listClientSecretSetups,
  listClients,
  saveClientSecretSetup,
  updateClient,
  upsertClientAsset,
} from "../db";
import { encryptSetupValue, hasProtectedValue } from "../clientSecurity";
import { decodeImageDataUrl, MAX_DATA_URL_CHARS, processUploadedImage } from "../imageProcessing";
import { storagePutExact } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { ensureWorkspaceDefaults } from "../workspaceDb";
import { UpdateConflictError, isDuplicateKeyError } from "../trpcErrors";
import type { Client, ClientAsset } from "../../drizzle/schema";

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

function encryptedSetupValues(input: SecretSetupInput): Record<string, string> {
  const encryptedUpdates: Record<string, string> = {};
  for (const field of SECRET_FIELD_VALUES) {
    const value = input[field]?.trim();
    if (!value) continue;
    encryptedUpdates[secretColumnByField[field]] = encryptSetupValue(value);
  }
  return encryptedUpdates;
}

async function applySetupValues(clientId: number, input: SecretSetupInput): Promise<void> {
  const encryptedUpdates = encryptedSetupValues(input);
  if (Object.keys(encryptedUpdates).length > 0) {
    await saveClientSecretSetup(clientId, encryptedUpdates);
  }
}

function clientViewFrom(client: Client, assets: ClientAsset[], secretRow: ClientSecretSetup | undefined) {
  const secretStatus = secretStatusFromRow(secretRow);
  const readiness = buildReadiness(
    client as unknown as ClientInput,
    assets.map(asset => asset.slot).filter(isAssetSlot),
    secretStatus,
  );
  return { client, assets, secretStatus, readiness };
}

export async function getClientView(clientId: number) {
  const [client, assets, secretRow] = await Promise.all([
    getClientById(clientId),
    getClientAssets(clientId),
    getClientSecretSetup(clientId),
  ]);

  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
  return clientViewFrom(client, assets, secretRow);
}

export const clientsRouter = router({
  list: protectedProcedure.query(async () => {
    const [rows, assets, secretRows] = await Promise.all([
      listClients(),
      listClientAssets(),
      listClientSecretSetups(),
    ]);
    const assetsByClient = new Map<number, ClientAsset[]>();
    for (const asset of assets) {
      const current = assetsByClient.get(asset.clientId) ?? [];
      current.push(asset);
      assetsByClient.set(asset.clientId, current);
    }
    const secretsByClient = new Map(secretRows.map(row => [row.clientId, row]));
    return rows.map(row => clientViewFrom(row, assetsByClient.get(row.id) ?? [], secretsByClient.get(row.id)));
  }),

  get: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(({ input }) => getClientView(input.clientId)),

  create: protectedProcedure
    .input(z.object({ details: clientInputSchema, setup: secretSetupInputSchema }))
    .mutation(async ({ input }) => {
      try {
        const clientId = await createClientWithSecrets(
          { ...input.details, status: "draft" },
          encryptedSetupValues(input.setup),
        );
        await ensureWorkspaceDefaults(clientId);
        return getClientView(clientId);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
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
        expectedUpdatedAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await getClientById(input.clientId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      try {
        await updateClient(input.clientId, input.details, input.expectedUpdatedAt);
        await applySetupValues(input.clientId, input.setup);
        return getClientView(input.clientId);
      } catch (error) {
        if (error instanceof UpdateConflictError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        if (isDuplicateKeyError(error)) {
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
        dataUrl: z.string().min(20).max(MAX_DATA_URL_CHARS),
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

      try {
        await updateClient(input.clientId, { status: "ready", readyAt: new Date() }, view.client.updatedAt);
        return getClientView(input.clientId);
      } catch (error) {
        if (error instanceof UpdateConflictError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),
});
