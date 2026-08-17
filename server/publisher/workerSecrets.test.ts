import { describe, expect, it } from "vitest";
import {
  buildPublisherWorkerSecrets,
  PUBLISHER_WORKER_SECRET_KEYS,
} from "./workerSecrets";

describe("publisher Worker secret wiring", () => {
  it("uses the frozen lead-parity secret names", () => {
    expect(PUBLISHER_WORKER_SECRET_KEYS).toEqual([
      "GHL_API_KEY",
      "GHL_LOCATION_ID",
      "GOOGLE_SHEETS_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "META_PIXEL_ID",
      "META_CAPI_ACCESS_TOKEN",
      "STAGE_WEBHOOK_SECRET",
      "ALERT_WEBHOOK_URL",
    ]);
  });

  it("injects global Google credentials and omits empty optional secrets", () => {
    const privateKey = "-----BEGIN PRIVATE KEY-----\nopaque\n-----END PRIVATE KEY-----\n";
    const secrets = buildPublisherWorkerSecrets(
      {
        GHL_API_KEY: "opaque-ghl-key",
        GHL_LOCATION_ID: "location-123",
        GOOGLE_SHEETS_ID: "sheet-123",
        META_PIXEL_ID: "pixel-123",
        META_CAPI_ACCESS_TOKEN: "opaque-meta-token",
        STAGE_WEBHOOK_SECRET: "opaque-stage-secret",
        ALERT_WEBHOOK_URL: null,
      },
      {
        serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
        serviceAccountPrivateKey: privateKey,
      }
    );

    expect(secrets).toEqual([
      { name: "GHL_API_KEY", value: "opaque-ghl-key" },
      { name: "GHL_LOCATION_ID", value: "location-123" },
      { name: "GOOGLE_SHEETS_ID", value: "sheet-123" },
      {
        name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        value: "publisher@example.iam.gserviceaccount.com",
      },
      { name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", value: privateKey },
      { name: "META_PIXEL_ID", value: "pixel-123" },
      { name: "META_CAPI_ACCESS_TOKEN", value: "opaque-meta-token" },
      { name: "STAGE_WEBHOOK_SECRET", value: "opaque-stage-secret" },
    ]);
    expect(secrets.map(secret => secret.name)).not.toContain(
      "GHL_WEBHOOK_URL"
    );
    expect(secrets.map(secret => secret.name)).not.toContain(
      "META_TEST_EVENT_CODE"
    );
  });
});
