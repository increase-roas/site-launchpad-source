import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  WRANGLER_SECRET_VALUES,
  astroClientConfigInputSchema,
} from "../../shared/astroConfig";
import { getAstroConfigView, saveAstroConfig, saveWranglerSecrets } from "../astroConfigDb";
import { protectedProcedure, router } from "../_core/trpc";
import { toClientAstroConfigView, toGeneratedConfigExport } from "../secretRedaction";
import { mapRouterError } from "../trpcErrors";
import {
  advancePublish,
  publishStatus,
  startPublish,
} from "../publisher/publishAstroSite";

const clientIdInput = z.object({ clientId: z.number().int().positive() });
const wranglerSecretInputSchema = z.object(
  Object.fromEntries(
    WRANGLER_SECRET_VALUES.map(name => [name, z.string().max(20_000).optional()]),
  ) as Record<(typeof WRANGLER_SECRET_VALUES)[number], z.ZodOptional<z.ZodString>>,
);

export const astroConfigRouter = router({
  get: protectedProcedure.input(clientIdInput).query(async ({ input }) => {
    try {
      return toClientAstroConfigView(await getAstroConfigView(input.clientId));
    } catch (error) {
      throw mapRouterError(error, "Client configuration could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), config: astroClientConfigInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return toClientAstroConfigView(await saveAstroConfig(input.clientId, input.config));
      } catch (error) {
        throw mapRouterError(error, "Client configuration could not be saved.");
      }
    }),

  saveSecrets: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), values: wranglerSecretInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return toClientAstroConfigView(await saveWranglerSecrets(input.clientId, input.values));
      } catch (error) {
        throw mapRouterError(error, "Protected setup values could not be saved.");
      }
    }),

  exportGeneratedConfig: protectedProcedure.input(clientIdInput).mutation(async ({ input }) => {
    try {
      const view = await getAstroConfigView(input.clientId);
      if (!view.generatedConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generated client config is not available yet.",
        });
      }
      return toGeneratedConfigExport("client.config.ts", view.generatedConfig);
    } catch (error) {
      throw mapRouterError(error, "Generated client config could not be exported.");
    }
  }),

  startPublish: protectedProcedure.input(clientIdInput).mutation(async ({ input }) => {
    try {
      return await startPublish(input.clientId);
    } catch (error) {
      throw mapRouterError(error, "Website publishing could not be started.");
    }
  }),

  advancePublish: protectedProcedure
    .input(clientIdInput.extend({ retryFailed: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      try {
        return await advancePublish(input.clientId, input.retryFailed === true);
      } catch (error) {
        throw mapRouterError(error, "Website publishing could not be advanced.");
      }
    }),

  publishStatus: protectedProcedure.input(clientIdInput).query(async ({ input }) => {
    try {
      return await publishStatus(input.clientId);
    } catch (error) {
      throw mapRouterError(error, "Website publish status could not be loaded.");
    }
  }),
});
