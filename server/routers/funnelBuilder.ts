import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEPLOY_SUCCESS_MESSAGE, funnelEditorInputSchema } from "../../shared/funnelConfig";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createFunnelBuilder,
  getFunnelBuilderDetail,
  listFunnelBuilderCards,
  markFunnelDeployed,
  markFunnelReady,
  saveFunnelBuilder,
} from "../funnelConfigDb";
import { ensureWorkspaceDefaults } from "../workspaceDb";

function asPlainError(error: unknown, fallback: string) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : fallback,
  });
}

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
        throw asPlainError(error, "Funnels could not be loaded.");
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
        return await createFunnelBuilder(input.clientId, input.name);
      } catch (error) {
        throw asPlainError(error, "Funnel could not be created.");
      }
    }),

  get: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return await getFunnelBuilderDetail(input.clientId, input.funnelId);
    } catch (error) {
      throw asPlainError(error, "Funnel could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(ownedFunnelInput.extend({ config: funnelEditorInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return await saveFunnelBuilder(input.clientId, input.funnelId, input.config);
      } catch (error) {
        throw asPlainError(error, "Funnel could not be saved.");
      }
    }),

  deploy: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      const funnel = await markFunnelReady(input.clientId, input.funnelId);
      return { funnel, message: DEPLOY_SUCCESS_MESSAGE };
    } catch (error) {
      throw asPlainError(error, "Funnel is not ready to deploy.");
    }
  }),

  markDeployed: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return await markFunnelDeployed(input.clientId, input.funnelId);
    } catch (error) {
      throw asPlainError(error, "Deployed status could not be saved.");
    }
  }),
});
