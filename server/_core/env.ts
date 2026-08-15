export type RuntimeMode = "build" | "test" | "development" | "production";

const DEVELOPMENT_RUNTIME_ENV = [
  "VITE_APP_ID",
  "JWT_SECRET",
  "DATABASE_URL",
  "OAUTH_SERVER_URL",
  "OWNER_OPEN_ID",
  "BUILT_IN_FORGE_API_URL",
  "BUILT_IN_FORGE_API_KEY",
] as const;

const PRODUCTION_RUNTIME_ENV = [
  ...DEVELOPMENT_RUNTIME_ENV,
  "SECRETS_ENCRYPTION_KEY",
] as const;

export function deriveRuntimeMode(nodeEnv = process.env.NODE_ENV): RuntimeMode {
  switch (nodeEnv) {
    case undefined:
    case "":
      return "build";
    case "build":
    case "test":
    case "development":
    case "production":
      return nodeEnv;
    default:
      throw new Error(
        "Unsupported NODE_ENV. Expected build, test, development, or production.",
      );
  }
}

function requiredEnvNames(mode: RuntimeMode): readonly string[] {
  switch (mode) {
    case "build":
    case "test":
      return [];
    case "development":
      return DEVELOPMENT_RUNTIME_ENV;
    case "production":
      return PRODUCTION_RUNTIME_ENV;
    default: {
      const exhaustiveMode: never = mode;
      return exhaustiveMode;
    }
  }
}

export function validateRuntimeEnv(
  mode: RuntimeMode,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const missing = requiredEnvNames(mode).filter(
    name => !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for ${mode}: ${missing.join(", ")}`,
    );
  }
}

export function requireCookieSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  secretsEncryptionKey: process.env.SECRETS_ENCRYPTION_KEY ?? "",
};
