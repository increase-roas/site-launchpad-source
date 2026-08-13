import { z } from "zod";
import {
  funnelShapeSchema,
  funnelStepUpdateSchema,
  sectionOrderSchema,
} from "../../shared/workspace";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getWorkspace,
  replaceFunnelShape,
  saveHomepageSectionOrder,
  updateFunnelStep,
} from "../workspaceDb";
import { getClientView } from "./clients";
import { mapRouterError } from "../trpcErrors";

async function getCompleteWorkspace(clientId: number) {
  const [clientView, workspace] = await Promise.all([
    getClientView(clientId),
    getWorkspace(clientId),
  ]);
  return { ...clientView, ...workspace };
}

export const workspaceRouter = router({
  get: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await getCompleteWorkspace(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Client workspace could not be loaded.");
      }
    }),

  setFunnelShape: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        funnelId: z.number().int().positive(),
        shape: funnelShapeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await replaceFunnelShape(input.clientId, input.funnelId, input.shape);
        return await getCompleteWorkspace(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Funnel shape could not be changed.");
      }
    }),

  updateStep: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), step: funnelStepUpdateSchema }))
    .mutation(async ({ input }) => {
      try {
        await updateFunnelStep(input.clientId, input.step);
        return await getCompleteWorkspace(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Funnel step could not be saved.");
      }
    }),

  saveSections: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), sections: sectionOrderSchema }))
    .mutation(async ({ input }) => {
      try {
        await saveHomepageSectionOrder(input.clientId, input.sections);
        return await getCompleteWorkspace(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Homepage order could not be saved.");
      }
    }),
});
