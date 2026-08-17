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
  revealCrmCallbackSecret,
  saveSimpleFormConfig,
  saveSimpleFormSecrets,
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

  saveSecrets: protectedProcedure
    .input(
      ownedFunnelInput.extend({
        META_CAPI_ACCESS_TOKEN: optionalSecret,
        META_TEST_EVENT_CODE: optionalSecret,
        GHL_WEBHOOK_URL: optionalSecret,
        SUBMISSION_ALERT_WEBHOOK_URL: optionalSecret,
        clearMetaTestEventCode: z.boolean().optional(),
        regenerateCrmCallbackSecret: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { clientId, funnelId, ...secrets } = input;
        return await saveSimpleFormSecrets(clientId, funnelId, secrets);
      } catch (error) {
        throw mapRouterError(error, "Secrets could not be saved.");
      }
    }),

  revealCrmCallbackSecret: protectedProcedure.input(ownedFunnelInput).mutation(async ({ input }) => {
    try {
      return await revealCrmCallbackSecret(input.clientId, input.funnelId);
    } catch (error) {
      throw mapRouterError(error, "CRM Callback Secret could not be shown.");
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
