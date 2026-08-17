import { describe, expect, it } from "vitest";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
  getGooglePublisherEnvironment,
} from "./publisherEnv";

describe("publisher environment", () => {
  it("does not require publisher variables until a getter is called", () => {
    expect(() => getGitHubPublisherEnvironment({})).toThrow(
      "Missing required publisher environment variable: PUBLISHER_GITHUB_TOKEN."
    );
    expect(() => getCloudflarePublisherEnvironment({})).toThrow(
      "Missing required publisher environment variable: PUBLISHER_CLOUDFLARE_API_TOKEN."
    );
    expect(() => getGooglePublisherEnvironment({})).toThrow(
      "Missing required publisher environment variable: GOOGLE_SERVICE_ACCOUNT_EMAIL."
    );
  });

  it("reads GitHub and Cloudflare settings only from the supplied environment", () => {
    const environment: NodeJS.ProcessEnv = {
      PUBLISHER_GITHUB_TOKEN: "opaque-test-credential",
      PUBLISHER_GITHUB_OWNER: "customer-repositories",
      PUBLISHER_CLOUDFLARE_API_TOKEN: "opaque-cloudflare-credential",
      PUBLISHER_CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "publisher@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "opaque-google-private-key",
    };

    expect(getGitHubPublisherEnvironment(environment)).toEqual({
      token: "opaque-test-credential",
      owner: "customer-repositories",
    });
    expect(getCloudflarePublisherEnvironment(environment)).toEqual({
      apiToken: "opaque-cloudflare-credential",
      accountId: "0123456789abcdef0123456789abcdef",
    });
    expect(getGooglePublisherEnvironment(environment)).toEqual({
      serviceAccountEmail: "publisher@example.iam.gserviceaccount.com",
      serviceAccountPrivateKey: "opaque-google-private-key",
    });
  });

  it("rejects invalid non-secret settings without echoing supplied values", () => {
    const unsafeOwner = "unsafe/owner";
    const environment: NodeJS.ProcessEnv = {
      PUBLISHER_GITHUB_TOKEN: "opaque-test-credential",
      PUBLISHER_GITHUB_OWNER: unsafeOwner,
    };

    expect(() => getGitHubPublisherEnvironment(environment)).toThrow(
      "PUBLISHER_GITHUB_OWNER must be a valid GitHub owner."
    );
    try {
      getGitHubPublisherEnvironment(environment);
    } catch (error) {
      expect(String(error)).not.toContain(unsafeOwner);
    }
  });
});
