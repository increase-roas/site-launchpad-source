import {
  buildClientIntegrationProfileDto,
  emptyIdentifiers,
  emptySecretPresence,
  type ClientIntegrationProfileDto,
  type SecretPresence,
} from "../clientIntegrationProfile";

export type IntegrationPresenceField = {
  key: string;
  presence: SecretPresence;
};

export type IntegrationPresenceGroup = {
  id: string;
  label: string;
  fields: IntegrationPresenceField[];
};

export function emptyClientIntegrationPresence(clientId: number): ClientIntegrationProfileDto {
  return buildClientIntegrationProfileDto({
    clientId,
    identifiers: emptyIdentifiers(),
    secretPresence: emptySecretPresence(),
    lastUpdated: null,
    reconciliationStatus: "pending",
    conflictedKeys: [],
  });
}

export function integrationPresenceRows(dto: ClientIntegrationProfileDto): IntegrationPresenceGroup[] {
  return dto.groups.map(group => ({
    id: group.id,
    label: group.label,
    fields: group.fields.map(field => ({
      key: field.key,
      presence:
        field.kind === "identifier"
          ? field.identifierValue && field.identifierValue.trim()
            ? "SET"
            : "NOT SET"
          : (field.presence ?? "NOT SET"),
    })),
  }));
}

export function integrationPresenceHasSecretValue(dto: ClientIntegrationProfileDto, secretValues: readonly string[]): boolean {
  const serialized = JSON.stringify(integrationPresenceRows(dto));
  return secretValues.some(value => value.trim() && serialized.includes(value.trim()));
}
