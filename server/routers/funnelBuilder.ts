import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEPLOY_SUCCESS_MESSAGE, funnelEditorInputSchema } from "../../shared/funnelConfig";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { toClientFunnelBuilderDetail, toGeneratedConfigExport } from "../secretRedaction";
import {
  createFunnelBuilder,
  getFunnelBuilderDetail,
  listFunnelBuilderCards,
  markFunnelDeployed,
  markFunnelReady,
  saveFunnelBuilder,
} from "../funnelConfigDb";
import { ensureWorkspaceDefaults } from "../workspaceDb";
import { mapRouterError } from "../trpcErrors";

const ownedFunnelInput = z.object({
  clientId: z.number().int().positive(),
  funnelId: z.number().int().positive(),
});

export const funnelBuilderRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        await ensureWorkspaceDefaults(input.clientId);
        return await listFunnelBuilderCards(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Funnels could not be loaded.");
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        name: z.string().trim().min(2, "Enter a funnel name.").max(160),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return toClientFunnelBuilderDetail(await createFunnelBuilder(input.clientId, input.name));
      } catch (error) {
        throw mapRouterError(error, "Funnel could not be created.");
      }
    }),

  get: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return toClientFunnelBuilderDetail(await getFunnelBuilderDetail(input.clientId, input.funnelId));
    } catch (error) {
      throw mapRouterError(error, "Funnel could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(ownedFunnelInput.extend({ config: funnelEditorInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return toClientFunnelBuilderDetail(
          await saveFunnelBuilder(input.clientId, input.funnelId, input.config),
        );
      } catch (error) {
        throw mapRouterError(error, "Funnel could not be saved.");
      }
    }),

  exportGeneratedConfig: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      const detail = await getFunnelBuilderDetail(input.clientId, input.funnelId);
      if (!detail.config.generatedConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generated funnel config is not available yet.",
        });
      }
      return toGeneratedConfigExport("funnel.config.ts", detail.config.generatedConfig);
    } catch (error) {
      throw mapRouterError(error, "Generated funnel config could not be exported.");
    }
  }),

  deploy: adminProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      const detail = toClientFunnelBuilderDetail(await markFunnelReady(input.clientId, input.funnelId));
      return { funnel: detail, message: DEPLOY_SUCCESS_MESSAGE };
    } catch (error) {
      throw mapRouterError(error, "Funnel is not ready to deploy.");
    }
  }),

  markDeployed: adminProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return toClientFunnelBuilderDetail(await markFunnelDeployed(input.clientId, input.funnelId));
    } catch (error) {
      throw mapRouterError(error, "Deployed status could not be saved.");
    }
  }),
});
