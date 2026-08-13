import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEPLOY_SUCCESS_MESSAGE, funnelEditorInputSchema } from "../../shared/funnelConfig";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { toClientFunnelBuilderDetail } from "../secretRedaction";
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
        return toClientFunnelBuilderDetail(await createFunnelBuilder(input.clientId, input.name), {
          includeGeneratedConfig: false,
        });
      } catch (error) {
        throw asPlainError(error, "Funnel could not be created.");
      }
    }),

  get: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return toClientFunnelBuilderDetail(await getFunnelBuilderDetail(input.clientId, input.funnelId), {
        includeGeneratedConfig: false,
      });
    } catch (error) {
      throw asPlainError(error, "Funnel could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(ownedFunnelInput.extend({ config: funnelEditorInputSchema }))
    .mutation(async ({ input }) => {
      try {
        return toClientFunnelBuilderDetail(
          await saveFunnelBuilder(input.clientId, input.funnelId, input.config),
          { includeGeneratedConfig: true },
        );
      } catch (error) {
        throw asPlainError(error, "Funnel could not be saved.");
      }
    }),

  deploy: adminProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      const detail = toClientFunnelBuilderDetail(await markFunnelReady(input.clientId, input.funnelId), {
        includeGeneratedConfig: false,
      });
      return { funnel: detail, message: DEPLOY_SUCCESS_MESSAGE };
    } catch (error) {
      throw asPlainError(error, "Funnel is not ready to deploy.");
    }
  }),

  markDeployed: adminProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return toClientFunnelBuilderDetail(await markFunnelDeployed(input.clientId, input.funnelId), {
        includeGeneratedConfig: false,
      });
    } catch (error) {
      throw asPlainError(error, "Deployed status could not be saved.");
    }
  }),
});
