import { z } from "zod";
import { paidFunnelGraphSchema } from "../../shared/paidFunnelGraph";
import { paidFunnelSectionSchema } from "../../shared/paidFunnelGraph";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createPaidFunnelFromTemplate,
  getPaidFunnelDetail,
  importPaidFunnelZip,
  listPaidFunnelTemplates,
  listPaidFunnels,
  listReusableSections,
  savePaidFunnelGraph,
  saveReusableSection,
} from "../paidFunnelDb";
import { mapRouterError } from "../trpcErrors";

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

  saveGraph: protectedProcedure
    .input(
      ownedFunnelInput.extend({
        stepId: z.number().int().positive(),
        expectedUpdatedAt: z.coerce.date(),
        graph: paidFunnelGraphSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await savePaidFunnelGraph(input);
      } catch (error) {
        throw mapRouterError(error, "Funnel graph could not be saved.");
      }
    }),

  listReusableSections: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await listReusableSections(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Reusable sections could not be loaded.");
      }
    }),

  saveReusableSection: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        name: z.string().trim().min(1).max(160),
        section: paidFunnelSectionSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await saveReusableSection(input);
      } catch (error) {
        throw mapRouterError(error, "Reusable section could not be saved.");
      }
    }),
});
