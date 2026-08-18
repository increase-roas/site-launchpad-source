import { describe, expect, it } from "vitest";
import {
  buildPublisherWorkerSecrets,
  PUBLISHER_WORKER_SECRET_KEYS,
  resolveGooglePublisherSecrets,
} from "./workerSecrets";

const clientAKey =
  "-----BEGIN PRIVATE KEY-----\nCLIENT_A_PRIVATE_KEY\n-----END PRIVATE KEY-----\n";
const clientBKey =
  "-----BEGIN PRIVATE KEY-----\nCLIENT_B_PRIVATE_KEY\n-----END PRIVATE KEY-----\n";
const platformKey =
  "-----BEGIN PRIVATE KEY-----\nPLATFORM_PRIVATE_KEY\n-----END PRIVATE KEY-----\n";

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

  it("lets ClientIntegrationProfile Google credentials win", () => {
    const resolved = resolveGooglePublisherSecrets({
      clientId: 7,
      profileEmail: "client-a@example.iam.gserviceaccount.com",
      profilePrivateKey: clientAKey,
      loadPlatform: () => {
        throw new Error("platform credentials must not load when the profile is complete");
      },
    });
    expect(resolved.source).toBe("client-profile");
    const secrets = buildPublisherWorkerSecrets(
      {
        GHL_API_KEY: "opaque-ghl-key",
        GHL_LOCATION_ID: "location-123",
        GOOGLE_SHEETS_ID: "sheet-123",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "client-a@example.iam.gserviceaccount.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: clientAKey,
        META_PIXEL_ID: "pixel-123",
        META_CAPI_ACCESS_TOKEN: "opaque-meta-token",
        STAGE_WEBHOOK_SECRET: "opaque-stage-secret",
        ALERT_WEBHOOK_URL: null,
      },
      resolved.secrets
    );

    expect(secrets).toEqual([
      { name: "GHL_API_KEY", value: "opaque-ghl-key" },
      { name: "GHL_LOCATION_ID", value: "location-123" },
      { name: "GOOGLE_SHEETS_ID", value: "sheet-123" },
      {
        name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        value: "client-a@example.iam.gserviceaccount.com",
      },
      { name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", value: clientAKey.trim() },
      { name: "META_PIXEL_ID", value: "pixel-123" },
      { name: "META_CAPI_ACCESS_TOKEN", value: "opaque-meta-token" },
      { name: "STAGE_WEBHOOK_SECRET", value: "opaque-stage-secret" },
    ]);
  });

  it("uses platform Google credentials only as an explicit legacy fallback", () => {
    let platformLoads = 0;
    const resolved = resolveGooglePublisherSecrets({
      clientId: 7,
      profileEmail: null,
      profilePrivateKey: null,
      loadPlatform: () => {
        platformLoads += 1;
        return {
          serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
          serviceAccountPrivateKey: platformKey,
        };
      },
    });
    expect(resolved.source).toBe("platform-legacy-fallback");
    expect(platformLoads).toBe(1);
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
      resolved.secrets
    );
    expect(secrets.find(secret => secret.name === "GOOGLE_SERVICE_ACCOUNT_EMAIL")?.value).toBe(
      "publisher@example.iam.gserviceaccount.com"
    );
  });

  it("never mixes Google credentials from different sources", () => {
    expect(() =>
      resolveGooglePublisherSecrets({
        profileEmail: "client-a@example.iam.gserviceaccount.com",
        profilePrivateKey: "",
        loadPlatform: () => ({
          serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
          serviceAccountPrivateKey: platformKey,
        }),
      })
    ).toThrow(/same ClientIntegrationProfile/);

    expect(() =>
      buildPublisherWorkerSecrets(
        {
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "client-a@example.iam.gserviceaccount.com",
          GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: clientAKey,
        },
        {
          serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
          serviceAccountPrivateKey: platformKey,
        }
      )
    ).toThrow(/mix Google service-account/);
  });

  it("keeps client Google credentials isolated", () => {
    const clientA = resolveGooglePublisherSecrets({
      clientId: 7,
      profileEmail: "client-a@example.iam.gserviceaccount.com",
      profilePrivateKey: clientAKey,
    });
    const clientB = resolveGooglePublisherSecrets({
      clientId: 9,
      profileEmail: "client-b@example.iam.gserviceaccount.com",
      profilePrivateKey: clientBKey,
    });
    expect(clientA.secrets.serviceAccountEmail).not.toBe(clientB.secrets.serviceAccountEmail);
    expect(clientA.secrets.serviceAccountPrivateKey).not.toBe(
      clientB.secrets.serviceAccountPrivateKey
    );
  });

  it("redacts Google private keys from public error text", () => {
    expect(() =>
      resolveGooglePublisherSecrets({
        profileEmail: "client-a@example.iam.gserviceaccount.com",
        profilePrivateKey: "   ",
      })
    ).toThrow(/same ClientIntegrationProfile/);

    try {
      resolveGooglePublisherSecrets({
        profileEmail: "client-a@example.iam.gserviceaccount.com",
        profilePrivateKey: clientAKey,
        loadPlatform: () => ({
          serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
          serviceAccountPrivateKey: platformKey,
        }),
      });
      buildPublisherWorkerSecrets(
        {
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "client-a@example.iam.gserviceaccount.com",
          GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: clientAKey,
        },
        {
          serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
          serviceAccountPrivateKey: platformKey,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(clientAKey);
      expect(message).not.toContain(platformKey);
      expect(message).not.toContain("CLIENT_A_PRIVATE_KEY");
      expect(message).not.toContain("PLATFORM_PRIVATE_KEY");
    }
  });
});
