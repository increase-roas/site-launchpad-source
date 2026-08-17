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

export function buildPublisherWorkerSecrets(
  clientSecrets: PublisherWorkerSecretValues,
  googleSecrets: GooglePublisherSecrets
): Array<{ name: PublisherWorkerSecretKey; value: string }> {
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
