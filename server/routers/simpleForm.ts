import { z } from "zod";
import { simpleFormStoredRecordSchema } from "../../shared/simpleFormConfig";
import { SIMPLE_FORM_TEMPLATE_KEY } from "../../shared/simpleFormContract";
import { protectedProcedure, router } from "../_core/trpc";
import {
  advancePublish,
  publishStatus,
  startPublish,
} from "../publisher/publishSimpleForm";
import { mapRouterError } from "../trpcErrors";
import {
  createSimpleFormFromTemplate,
  getSimpleFormDetail,
  getSimpleFormPublishHandoff,
  listApprovedFunnelTemplates,
  saveSimpleFormConfig,
  saveSimpleFormIntegration,
} from "../simpleFormDb";

const ownedFunnelInput = z.object({
  clientId: z.number().int().positive(),
  funnelId: z.number().int().positive(),
});

const optionalSecret = z.string().max(8000).optional();

export const simpleFormRouter = router({
  listTemplates: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await listApprovedFunnelTemplates(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Templates could not be loaded.");
      }
    }),

  createFromTemplate: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        templateKey: z.literal(SIMPLE_FORM_TEMPLATE_KEY),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await createSimpleFormFromTemplate(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Funnel could not be created from the template.");
      }
    }),

  get: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return await getSimpleFormDetail(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Simple Form funnel could not be loaded.");
    }
  }),

  save: protectedProcedure
    .input(ownedFunnelInput.extend({ record: simpleFormStoredRecordSchema }))
    .mutation(async ({ input }) => {
      try {
        return await saveSimpleFormConfig(input.clientId, input.funnelId, input.record);
      } catch (error) {
        throw mapRouterError(error, "Simple Form settings could not be saved.");
      }
    }),

  saveIntegration: protectedProcedure
    .input(
      ownedFunnelInput.extend({
        GHL_LOCATION_ID: z.string().max(255).optional(),
        GOOGLE_SHEETS_ID: z.string().max(255).optional(),
        META_PIXEL_ID: z.string().max(255).optional(),
        GHL_API_KEY: optionalSecret,
        META_CAPI_ACCESS_TOKEN: optionalSecret,
        ALERT_WEBHOOK_URL: optionalSecret,
        clearAlertWebhookUrl: z.boolean().optional(),
        regenerateStageWebhookSecret: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { clientId, funnelId, ...integration } = input;
        return await saveSimpleFormIntegration(clientId, funnelId, integration);
      } catch (error) {
        throw mapRouterError(error, "Lead integration settings could not be saved.");
      }
    }),

  publishHandoff: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return await getSimpleFormPublishHandoff(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Publish handoff could not be loaded.");
    }
  }),

  startPublish: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return await startPublish(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Publishing could not be started.");
    }
  }),

  advancePublish: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return await advancePublish(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Publishing could not be advanced.");
    }
  }),

  publishStatus: protectedProcedure.input(ownedFunnelInput).query(async ({ input }) => {
    try {
      return await publishStatus(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "Publish status could not be loaded.");
    }
  }),
});
