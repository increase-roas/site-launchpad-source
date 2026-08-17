export type GitHubPublisherEnvironment = {
  token: string;
  owner: string;
};

export type CloudflarePublisherEnvironment = {
  apiToken: string;
  accountId: string;
};

export const PUBLISHER_ENVIRONMENT_NAMES = {
  githubToken: "PUBLISHER_GITHUB_TOKEN",
  githubOwner: "PUBLISHER_GITHUB_OWNER",
  cloudflareApiToken: "PUBLISHER_CLOUDFLARE_API_TOKEN",
  cloudflareAccountId: "PUBLISHER_CLOUDFLARE_ACCOUNT_ID",
} as const;

type PublisherEnvironmentName =
  (typeof PUBLISHER_ENVIRONMENT_NAMES)[keyof typeof PUBLISHER_ENVIRONMENT_NAMES];

const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const CLOUDFLARE_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;

function requirePublisherValue(
  environment: NodeJS.ProcessEnv,
  name: PublisherEnvironmentName
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required publisher environment variable: ${name}.`
    );
  }
  return value;
}

export function getGitHubPublisherEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): GitHubPublisherEnvironment {
  const token = requirePublisherValue(
    environment,
    PUBLISHER_ENVIRONMENT_NAMES.githubToken
  );
  const owner = requirePublisherValue(
    environment,
    PUBLISHER_ENVIRONMENT_NAMES.githubOwner
  );
  if (!GITHUB_OWNER_PATTERN.test(owner)) {
    throw new Error("PUBLISHER_GITHUB_OWNER must be a valid GitHub owner.");
  }
  return { token, owner };
}

export function getCloudflarePublisherEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): CloudflarePublisherEnvironment {
  const apiToken = requirePublisherValue(
    environment,
    PUBLISHER_ENVIRONMENT_NAMES.cloudflareApiToken
  );
  const accountId = requirePublisherValue(
    environment,
    PUBLISHER_ENVIRONMENT_NAMES.cloudflareAccountId
  );
  if (!CLOUDFLARE_ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error(
      "PUBLISHER_CLOUDFLARE_ACCOUNT_ID must be a valid Cloudflare account ID."
    );
  }
  return { apiToken, accountId };
}
