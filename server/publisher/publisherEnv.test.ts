import { describe, expect, it } from "vitest";
import {
  getCloudflarePublisherEnvironment,
  getGitHubPublisherEnvironment,
} from "./publisherEnv";

describe("publisher environment", () => {
  it("does not require publisher variables until a getter is called", () => {
    expect(() => getGitHubPublisherEnvironment({})).toThrow(
      "Missing required publisher environment variable: PUBLISHER_GITHUB_TOKEN."
    );
    expect(() => getCloudflarePublisherEnvironment({})).toThrow(
      "Missing required publisher environment variable: PUBLISHER_CLOUDFLARE_API_TOKEN."
    );
  });

  it("reads GitHub and Cloudflare settings only from the supplied environment", () => {
    const environment: NodeJS.ProcessEnv = {
      PUBLISHER_GITHUB_TOKEN: "opaque-test-credential",
      PUBLISHER_GITHUB_OWNER: "customer-repositories",
      PUBLISHER_CLOUDFLARE_API_TOKEN: "opaque-cloudflare-credential",
      PUBLISHER_CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    };

    expect(getGitHubPublisherEnvironment(environment)).toEqual({
      token: "opaque-test-credential",
      owner: "customer-repositories",
    });
    expect(getCloudflarePublisherEnvironment(environment)).toEqual({
      apiToken: "opaque-cloudflare-credential",
      accountId: "0123456789abcdef0123456789abcdef",
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
