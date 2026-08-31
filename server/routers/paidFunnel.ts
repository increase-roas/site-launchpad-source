import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createPaidFunnelFromTemplate,
  getPaidFunnelDetail,
  importPaidFunnelZip,
  listPaidFunnelTemplates,
  listPaidFunnels,
} from "../paidFunnelDb";
import { mapRouterError } from "../trpcErrors";
import {
  advancePublish,
  publishStatus,
  startPublish,
} from "../publisher/publishGenericPaidFunnel";

const ownedFunnelInput = z.object({
  clientId: z.number().int().positive(),
  funnelId: z.number().int().positive(),
});

export const paidFunnelRouter = router({
  listTemplates: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await listPaidFunnelTemplates(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Templates could not be loaded.");
      }
    }),

  importZip: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        filename: z.string().trim().min(1).max(240),
        zipBase64: z.string().min(1),
        storageKey: z.string().trim().min(1).max(800).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await importPaidFunnelZip(input);
      } catch (error) {
        throw mapRouterError(error, "Zip could not be imported.");
      }
    }),

  createFromTemplate: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        templateKey: z.string().trim().min(1).max(80),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await createPaidFunnelFromTemplate(
          input.clientId,
          input.templateKey
        );
      } catch (error) {
        throw mapRouterError(
          error,
          "Paid funnel could not be created from the template."
        );
      }
    }),

  listFunnels: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await listPaidFunnels(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Funnels could not be loaded.");
      }
    }),

  get: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return await getPaidFunnelDetail(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Paid funnel could not be loaded.");
    }
  }),

  startPublish: protectedProcedure
    .input(ownedFunnelInput)
    .mutation(async ({ input }) => {
      try {
        return await startPublish(input.clientId, input.funnelId);
      } catch (error) {
        throw mapRouterError(error, "Paid funnel publishing could not be started.");
      }
    }),

  advancePublish: protectedProcedure
    .input(ownedFunnelInput.extend({ retryFailed: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      try {
        return await advancePublish(
          input.clientId,
          input.funnelId,
          input.retryFailed === true,
        );
      } catch (error) {
        throw mapRouterError(error, "Paid funnel publishing could not advance.");
      }
    }),

  publishStatus: protectedProcedure
    .input(ownedFunnelInput)
    .query(async ({ input }) => {
      try {
        return await publishStatus(input.clientId, input.funnelId);
      } catch (error) {
        throw mapRouterError(error, "Paid funnel publishing status could not be loaded.");
      }
    }),
});
