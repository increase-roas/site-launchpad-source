import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClientSecretSetup } from "../../drizzle/schema";
import {
  SECRET_FIELD_VALUES,
  buildReadiness,
  clientInputSchema,
  draftClientInputSchema,
  emptySecretStatus,
  isAssetSlot,
  secretSetupInputSchema,
  type ClientInput,
  type SecretSetupInput,
  type SecretStatus,
} from "../../shared/client";
import {
  createClientWithSecrets,
  createDraftClient,
  getClientAssets,
  getClientById,
  getClientSecretSetup,
  listClientAssets,
  listClientSecretSetups,
  listClients,
  saveClientSecretSetup,
  updateClient,
} from "../db";
import { encryptSetupValue, hasProtectedValue } from "../clientSecurity";
import { observeRuntimeOperation } from "../_core/operationTelemetry";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
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
    const [rows, assets, secretRows] = await observeRuntimeOperation(
      "clients_list_database",
      () =>
        Promise.all([
          listClients(),
          listClientAssets(),
          listClientSecretSetups(),
        ]),
    );
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

  createDraft: protectedProcedure
    .input(draftClientInputSchema)
    .mutation(async ({ input }) => {
      try {
        const clientId = await createDraftClient(input.businessName);
        return getClientView(clientId);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That short name is already used. Try a slightly different business name.",
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
