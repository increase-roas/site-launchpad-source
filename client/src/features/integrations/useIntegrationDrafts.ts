import {
  CLIENT_INTEGRATION_IDENTIFIER_KEYS,
  CLIENT_INTEGRATION_SECRET_KEYS,
  clientIntegrationFieldError,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationProfileDto,
  type ClientIntegrationProfileKey,
  type ClientIntegrationSecretKey,
} from "@shared/clientIntegrationProfile";
import { useCallback, useMemo, useState } from "react";

const STAGE_WEBHOOK_SECRET = "STAGE_WEBHOOK_SECRET" as const;

type IdentifierDrafts = Record<ClientIntegrationIdentifierKey, string>;
type SecretDrafts = Partial<Record<ClientIntegrationSecretKey, string>>;

export type IntegrationSavePayload = {
  expectedUpdatedAt: Date | null;
  identifiers: Partial<Record<ClientIntegrationIdentifierKey, string | null>>;
  replaceSecrets: Partial<Record<ClientIntegrationSecretKey, string>>;
  clearSecrets: ClientIntegrationSecretKey[];
  rotateStageWebhookSecret: true | undefined;
};

function identifierDraftsFrom(dto: ClientIntegrationProfileDto): IdentifierDrafts {
  return {
    GHL_LOCATION_ID: dto.identifiers.GHL_LOCATION_ID ?? "",
    GOOGLE_SHEETS_ID: dto.identifiers.GOOGLE_SHEETS_ID ?? "",
    META_PIXEL_ID: dto.identifiers.META_PIXEL_ID ?? "",
  };
}

function without<T>(list: T[], value: T): T[] {
  return list.filter(entry => entry !== value);
}

/**
 * Owns every unsaved edit on the integrations form and turns them into the save
 * payload. Kept apart from the components so the save contract — which secrets
 * are replaced, cleared, or rotated, and which version we are writing against —
 * lives in one readable place.
 */
export function useIntegrationDrafts(dto: ClientIntegrationProfileDto) {
  const [identifiers, setIdentifiers] = useState<IdentifierDrafts>(() =>
    identifierDraftsFrom(dto),
  );
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<Date | null>(dto.lastUpdated);
  const [secrets, setSecrets] = useState<SecretDrafts>({});
  const [clearedSecrets, setClearedSecrets] = useState<ClientIntegrationSecretKey[]>([]);
  const [rotateStageWebhookSecret, setRotateStageWebhookSecret] = useState(false);

  const setIdentifier = useCallback((key: ClientIntegrationIdentifierKey, value: string) => {
    setIdentifiers(current => ({ ...current, [key]: value }));
  }, []);

  const setSecret = useCallback((key: ClientIntegrationSecretKey, value: string) => {
    setSecrets(current => ({ ...current, [key]: value }));
    setClearedSecrets(current => without(current, key));
    if (key === STAGE_WEBHOOK_SECRET) setRotateStageWebhookSecret(false);
  }, []);

  const discardSecretDraft = useCallback((key: ClientIntegrationSecretKey) => {
    setSecrets(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const toggleClearSecret = useCallback(
    (key: ClientIntegrationSecretKey) => {
      const willClear = !clearedSecrets.includes(key);
      setClearedSecrets(current => (willClear ? [...current, key] : without(current, key)));
      if (!willClear) return;
      setSecrets(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (key === STAGE_WEBHOOK_SECRET) setRotateStageWebhookSecret(false);
    },
    [clearedSecrets],
  );

  const requestRotate = useCallback(() => {
    setSecrets(current => {
      const next = { ...current };
      delete next[STAGE_WEBHOOK_SECRET];
      return next;
    });
    setClearedSecrets(current => without(current, STAGE_WEBHOOK_SECRET));
    setRotateStageWebhookSecret(true);
  }, []);

  const cancelRotate = useCallback(() => setRotateStageWebhookSecret(false), []);

  const discard = useCallback(() => {
    setIdentifiers(identifierDraftsFrom(dto));
    setSecrets({});
    setClearedSecrets([]);
    setRotateStageWebhookSecret(false);
  }, [dto]);

  const applySaved = useCallback((saved: ClientIntegrationProfileDto) => {
    setIdentifiers(identifierDraftsFrom(saved));
    setBaseUpdatedAt(saved.lastUpdated);
    setSecrets({});
    setClearedSecrets([]);
    setRotateStageWebhookSecret(false);
  }, []);

  /** Conflict recovery: take the winning identifiers but keep unsaved secret work. */
  const adoptRemoteIdentifiers = useCallback((remote: ClientIntegrationProfileDto) => {
    setIdentifiers(identifierDraftsFrom(remote));
    setBaseUpdatedAt(remote.lastUpdated);
  }, []);

  const changedIdentifierKeys = useMemo(
    () =>
      CLIENT_INTEGRATION_IDENTIFIER_KEYS.filter(
        key => identifiers[key].trim() !== (dto.identifiers[key] ?? ""),
      ),
    [dto.identifiers, identifiers],
  );

  const replacedSecretKeys = useMemo(
    () => CLIENT_INTEGRATION_SECRET_KEYS.filter(key => Boolean(secrets[key]?.trim())),
    [secrets],
  );

  const fieldErrors = useMemo(() => {
    const errors = new Map<ClientIntegrationProfileKey, string>();
    for (const key of CLIENT_INTEGRATION_IDENTIFIER_KEYS) {
      const error = clientIntegrationFieldError(key, identifiers[key]);
      if (error) errors.set(key, error);
    }
    for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
      const value = secrets[key];
      if (!value?.trim()) continue;
      const error = clientIntegrationFieldError(key, value);
      if (error) errors.set(key, error);
    }
    return errors;
  }, [identifiers, secrets]);

  const changeCount =
    changedIdentifierKeys.length +
    replacedSecretKeys.length +
    clearedSecrets.length +
    (rotateStageWebhookSecret ? 1 : 0);

  const buildPayload = useCallback(
    (): IntegrationSavePayload => ({
      // Keep the version captured with these drafts. A background refetch must
      // not bless stale identifiers with a newer optimistic-lock token.
      expectedUpdatedAt: baseUpdatedAt,
      identifiers: Object.fromEntries(
        changedIdentifierKeys.map(key => [key, identifiers[key].trim() || null]),
      ),
      replaceSecrets: Object.fromEntries(
        replacedSecretKeys.map(key => [key, (secrets[key] ?? "").trim()]),
      ),
      clearSecrets: clearedSecrets,
      rotateStageWebhookSecret: rotateStageWebhookSecret || undefined,
    }),
    [
      baseUpdatedAt,
      changedIdentifierKeys,
      clearedSecrets,
      identifiers,
      replacedSecretKeys,
      rotateStageWebhookSecret,
      secrets,
    ],
  );

  return {
    identifiers,
    secrets,
    clearedSecrets,
    rotateStageWebhookSecret,
    fieldErrors,
    changeCount,
    hasChanges: changeCount > 0,
    setIdentifier,
    setSecret,
    discardSecretDraft,
    toggleClearSecret,
    requestRotate,
    cancelRotate,
    discard,
    applySaved,
    adoptRemoteIdentifiers,
    buildPayload,
  };
}

export type IntegrationDrafts = ReturnType<typeof useIntegrationDrafts>;
