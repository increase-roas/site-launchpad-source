import {
  simpleFormOperatorConfigSchema,
  type SimpleFormValidatedConfiguration,
} from "../../shared/simpleFormConfig";

export const SAFE_GHL_WEBHOOK_PLACEHOLDER =
  "https://example.invalid/ghl-webhook";

export function renderFunnelConfigTs(
  configuration: SimpleFormValidatedConfiguration
): string {
  const publicConfiguration =
    simpleFormOperatorConfigSchema.parse(configuration);
  const serialized = JSON.stringify(
    {
      ...publicConfiguration,
      ghlWebhookUrl: SAFE_GHL_WEBHOOK_PLACEHOLDER,
    },
    null,
    2
  );
  return `import { defineFunnelConfig } from "./src/lib/config-schema";

export default defineFunnelConfig(${serialized});
`;
}
