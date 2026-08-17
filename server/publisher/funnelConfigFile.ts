import {
  simpleFormOperatorConfigSchema,
  type SimpleFormOperatorConfig,
} from "../../shared/simpleFormConfig";

export function renderFunnelConfigTs(
  configuration: SimpleFormOperatorConfig
): string {
  const publicConfiguration =
    simpleFormOperatorConfigSchema.parse(configuration);
  const serialized = JSON.stringify(publicConfiguration, null, 2);
  return `import { defineFunnelConfig } from "./src/lib/config-schema";

export default defineFunnelConfig(${serialized});
`;
}
