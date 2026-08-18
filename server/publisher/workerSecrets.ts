export const PUBLISHER_WORKER_SECRET_KEYS = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GOOGLE_SHEETS_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "STAGE_WEBHOOK_SECRET",
  "ALERT_WEBHOOK_URL",
] as const;

export type PublisherWorkerSecretKey =
  (typeof PUBLISHER_WORKER_SECRET_KEYS)[number];

export type PublisherWorkerSecretValues = Partial<
  Record<PublisherWorkerSecretKey, string | null>
>;

export type GooglePublisherSecrets = {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

export type GooglePublisherSecretSource =
  | "client-profile"
  | "platform-legacy-fallback";

export type ResolvedGooglePublisherSecrets = {
  source: GooglePublisherSecretSource;
  secrets: GooglePublisherSecrets;
};

function trimSecret(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function resolveGooglePublisherSecrets(input: {
  clientId?: number;
  profileEmail?: string | null;
  profilePrivateKey?: string | null;
  loadPlatform?: () => GooglePublisherSecrets;
}): ResolvedGooglePublisherSecrets {
  const email = trimSecret(input.profileEmail);
  const privateKey = trimSecret(input.profilePrivateKey);
  if (email && privateKey) {
    return {
      source: "client-profile",
      secrets: {
        serviceAccountEmail: email,
        serviceAccountPrivateKey: privateKey,
      },
    };
  }
  if (email || privateKey) {
    throw new Error(
      "Google service-account email and private key must come from the same ClientIntegrationProfile. Partial profile credentials cannot be mixed with platform credentials."
    );
  }
  const platform = input.loadPlatform?.();
  const platformEmail = trimSecret(platform?.serviceAccountEmail);
  const platformKey = trimSecret(platform?.serviceAccountPrivateKey);
  if (!platformEmail || !platformKey) {
    throw new Error(
      "Missing Google publisher credentials. Set them on the client integration profile or provide the explicit platform legacy fallback pair."
    );
  }
  return {
    source: "platform-legacy-fallback",
    secrets: {
      serviceAccountEmail: platformEmail,
      serviceAccountPrivateKey: platformKey,
    },
  };
}

export function assertGoogleSecretsNotMixed(
  clientSecrets: PublisherWorkerSecretValues,
  googleSecrets: GooglePublisherSecrets
): void {
  const clientEmail = trimSecret(clientSecrets.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const clientKey = trimSecret(clientSecrets.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (clientEmail && clientEmail !== googleSecrets.serviceAccountEmail) {
    throw new Error(
      "Refusing to mix Google service-account email from a different credential source."
    );
  }
  if (clientKey && clientKey !== googleSecrets.serviceAccountPrivateKey) {
    throw new Error(
      "Refusing to mix Google service-account private key from a different credential source."
    );
  }
}

export function buildPublisherWorkerSecrets(
  clientSecrets: PublisherWorkerSecretValues,
  googleSecrets: GooglePublisherSecrets
): Array<{ name: PublisherWorkerSecretKey; value: string }> {
  assertGoogleSecretsNotMixed(clientSecrets, googleSecrets);
  const values: PublisherWorkerSecretValues = {
    ...clientSecrets,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: googleSecrets.serviceAccountEmail,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      googleSecrets.serviceAccountPrivateKey,
  };

  return PUBLISHER_WORKER_SECRET_KEYS.flatMap(name => {
    const value = values[name];
    return typeof value === "string" && value.trim()
      ? [{ name, value }]
      : [];
  });
}
