import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ASTRO_ASSET_FILENAMES,
  ASTRO_ASSET_SLOT_VALUES,
  WRANGLER_SECRET_VALUES,
  astroClientConfigInputSchema,
} from "../../shared/astroConfig";
import { sanitizeClientFolder } from "../../shared/client";
import { getAstroConfigView, saveAstroConfig, saveWranglerSecrets } from "../astroConfigDb";
import { getClientById, upsertClientAsset } from "../db";
import { decodeImageDataUrl, processAstroUploadedImage } from "../imageProcessing";
import { storagePutExact } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const clientIdInput = z.object({ clientId: z.number().int().positive() });
const wranglerSecretInputSchema = z.object(
  Object.fromEntries(
    WRANGLER_SECRET_VALUES.map(name => [name, z.string().max(20_000).optional()]),
  ) as Record<(typeof WRANGLER_SECRET_VALUES)[number], z.ZodOptional<z.ZodString>>,
);

function plainError(error: unknown, fallback: string): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : fallback,
  });
}

export const astroConfigRouter = router({
  get: protectedProcedure.input(clientIdInput).query(async ({ input }) => {
    try {
      return await getAstroConfigView(input.clientId);
    } catch (error) {
      throw plainError(error, "Client configuration could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), config: astroClientConfigInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return await saveAstroConfig(input.clientId, input.config);
      } catch (error) {
        throw plainError(error, "Client configuration could not be saved.");
      }
    }),

  saveSecrets: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), values: wranglerSecretInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return await saveWranglerSecrets(input.clientId, input.values);
      } catch (error) {
        throw plainError(error, "Protected setup values could not be saved.");
      }
    }),

  uploadAsset: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        slot: z.enum(ASTRO_ASSET_SLOT_VALUES),
        originalFilename: z.string().trim().min(1).max(500),
        dataUrl: z.string().min(20).max(30_000_000),
      }),
    )
    .mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      try {
        const decoded = decodeImageDataUrl(input.dataUrl);
        const processed = await processAstroUploadedImage(decoded.buffer, input.slot);
        const folder = sanitizeClientFolder(client.shortName) || `client-${client.id}`;
        const filename = ASTRO_ASSET_FILENAMES[input.slot];
        const stored = await storagePutExact(
          `clients/${client.id}-${folder}/astro/${filename}`,
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
        return getAstroConfigView(client.id);
      } catch (error) {
        throw plainError(error, "That image could not be uploaded.");
      }
    }),
});
