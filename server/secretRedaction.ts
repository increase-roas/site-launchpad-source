type FunnelProfileInput = {
  businessName: string;
  phone: string;
  serviceArea: string;
  metaPixelId: string;
  ghlWebhookUrl: string;
  missingSetup: string[];
};

type FunnelConfigInput = {
  serviceArea: string;
  offerHeadline: string;
  offerSubheadline: string;
  thankYouMessage: string;
  generatedConfig: string;
  generatedAt: Date | null;
};

export function toClientFunnelProfile(profile: FunnelProfileInput) {
  return {
    businessName: profile.businessName,
    phone: profile.phone,
    serviceArea: profile.serviceArea,
    hasMetaPixelId: Boolean(profile.metaPixelId),
    hasGhlWebhookUrl: Boolean(profile.ghlWebhookUrl),
    missingSetup: profile.missingSetup,
  };
}

export function toClientFunnelConfig(config: FunnelConfigInput) {
  return {
    serviceArea: config.serviceArea,
    offerHeadline: config.offerHeadline,
    offerSubheadline: config.offerSubheadline,
    thankYouMessage: config.thankYouMessage,
    generatedConfig: "",
    hasGeneratedConfig: Boolean(config.generatedConfig),
    generatedAt: config.generatedAt,
  };
}

export function toClientFunnelBuilderDetail<TFunnel, TQuestions>(detail: {
  funnel: TFunnel;
  config: FunnelConfigInput;
  questions: TQuestions;
  profile: FunnelProfileInput;
}) {
  return {
    funnel: detail.funnel,
    config: toClientFunnelConfig(detail.config),
    questions: detail.questions,
    profile: toClientFunnelProfile(detail.profile),
  };
}

export function toClientAstroConfigView<
  TView extends { generatedConfig: string; input?: unknown },
>(view: TView) {
  const input = view.input;
  const safeInput =
    input && typeof input === "object" && "integrations" in input
      ? {
          ...input,
          integrations: {
            ...(input.integrations as Record<string, unknown>),
            ghl: {
              ...((input.integrations as Record<string, unknown>).ghl as object | undefined),
              config: {},
            },
            meta: {
              ...((input.integrations as Record<string, unknown>).meta as object | undefined),
              config: {},
            },
          },
        }
      : input;
  return {
    ...view,
    ...(Object.prototype.hasOwnProperty.call(view, "input") ? { input: safeInput } : {}),
    generatedConfig: "",
    hasGeneratedConfig: Boolean(view.generatedConfig),
  };
}

export function toGeneratedConfigExport(fileName: string, contents: string) {
  return { fileName, contents };
}
