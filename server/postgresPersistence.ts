import {
  astroClientConfigs,
  clientAssets,
  clientIntegrationProfiles,
  clientLeadIntegrations,
  clientSecretSetups,
  funnelConfigs,
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  users,
  wranglerSecretSetups,
} from "../drizzle/schema";

export const postgresConflictTargets = {
  users: users.authUserId,
  clientSecretSetups: clientSecretSetups.clientId,
  clientAssets: [clientAssets.clientId, clientAssets.slot],
  clientIntegrationProfiles: clientIntegrationProfiles.clientId,
  clientLeadIntegrations: clientLeadIntegrations.clientId,
  astroClientConfigs: astroClientConfigs.clientId,
  wranglerSecretSetups: wranglerSecretSetups.clientId,
  funnelConfigs: funnelConfigs.funnelId,
  funnelSimpleFormConfigs: funnelSimpleFormConfigs.funnelId,
  funnelRuntimeSecrets: funnelRuntimeSecrets.funnelId,
};

export function requireSinglePositiveId(
  rows: readonly { id: number }[],
  failureMessage: string,
): number {
  if (rows.length !== 1) throw new Error(failureMessage);
  const id = rows[0].id;
  if (!Number.isInteger(id) || id <= 0) throw new Error(failureMessage);
  return id;
}

export function withUpdatedAt<T extends object>(
  values: T,
  updatedAt: Date = new Date(),
): T & { updatedAt: Date } {
  return { ...values, updatedAt };
}
