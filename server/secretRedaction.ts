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

export function toClientFunnelConfig(
  config: FunnelConfigInput,
  options: { includeGeneratedConfig: boolean },
) {
  return {
    serviceArea: config.serviceArea,
    offerHeadline: config.offerHeadline,
    offerSubheadline: config.offerSubheadline,
    thankYouMessage: config.thankYouMessage,
    generatedConfig: options.includeGeneratedConfig ? config.generatedConfig : "",
    hasGeneratedConfig: Boolean(config.generatedConfig),
    generatedAt: config.generatedAt,
  };
}

export function toClientFunnelBuilderDetail<TFunnel, TQuestions>(
  detail: {
    funnel: TFunnel;
    config: FunnelConfigInput;
    questions: TQuestions;
    profile: FunnelProfileInput;
  },
  options: { includeGeneratedConfig: boolean },
) {
  return {
    funnel: detail.funnel,
    config: toClientFunnelConfig(detail.config, options),
    questions: detail.questions,
    profile: toClientFunnelProfile(detail.profile),
  };
}

export function toClientAstroConfigView<TView extends { generatedConfig: string }>(
  view: TView,
  options: { includeGeneratedConfig: boolean },
) {
  return {
    ...view,
    generatedConfig: options.includeGeneratedConfig ? view.generatedConfig : "",
    hasGeneratedConfig: Boolean(view.generatedConfig),
  };
}
