export type RuntimeMode = "build" | "test" | "development" | "production";

const DEVELOPMENT_RUNTIME_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "AUTH_ALLOWED_EMAILS",
  "AUTH_ADMIN_EMAILS",
  "JWT_SECRET",
  "DATABASE_URL",
  "BUILT_IN_FORGE_API_URL",
  "BUILT_IN_FORGE_API_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_ASSET_BASE_URL",
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
    name =>
      name === "AUTH_ADMIN_EMAILS"
        ? environment[name] === undefined
        : !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for ${mode}: ${missing.join(", ")}`,
    );
  }

  if (mode === "development" || mode === "production") {
    readSupabaseAuthConfiguration(environment);
    readR2Configuration(environment);
  }
}

const EXACT_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmailList(
  value: string | undefined,
  variableName: "AUTH_ALLOWED_EMAILS" | "AUTH_ADMIN_EMAILS",
  allowEmpty: boolean,
): ReadonlySet<string> {
  const entries = (value ?? "")
    .split(",")
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!allowEmpty && entries.length === 0) {
    throw new Error(`${variableName} must contain at least one exact email address.`);
  }

  if (
    entries.some(
      entry =>
        entry.includes("*") ||
        !EXACT_EMAIL_PATTERN.test(entry),
    )
  ) {
    throw new Error(`${variableName} must contain only exact email addresses.`);
  }

  return new Set(entries);
}

export type SupabaseAuthConfiguration = {
  supabaseUrl: string;
  publishableKey: string;
  allowedEmails: ReadonlySet<string>;
  adminEmails: ReadonlySet<string>;
};

export type R2Configuration = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicAssetBaseUrl: string;
};

const R2_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const R2_BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function readR2Configuration(
  environment: NodeJS.ProcessEnv = process.env,
): R2Configuration {
  const accountId = environment.R2_ACCOUNT_ID?.trim();
  if (!accountId || !R2_ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error("R2_ACCOUNT_ID must be a valid Cloudflare account ID.");
  }

  const accessKeyId = environment.R2_ACCESS_KEY_ID?.trim();
  if (!accessKeyId) {
    throw new Error("R2_ACCESS_KEY_ID is required.");
  }

  const secretAccessKey = environment.R2_SECRET_ACCESS_KEY?.trim();
  if (!secretAccessKey) {
    throw new Error("R2_SECRET_ACCESS_KEY is required.");
  }

  const bucket = environment.R2_BUCKET?.trim();
  if (!bucket || !R2_BUCKET_PATTERN.test(bucket)) {
    throw new Error("R2_BUCKET must be a safe lowercase bucket name.");
  }

  const rawPublicAssetBaseUrl = environment.R2_PUBLIC_ASSET_BASE_URL?.trim();
  let publicAssetBaseUrl: URL;
  try {
    publicAssetBaseUrl = new URL(rawPublicAssetBaseUrl ?? "");
  } catch {
    throw new Error("R2_PUBLIC_ASSET_BASE_URL must be a valid HTTPS origin.");
  }
  if (
    publicAssetBaseUrl.protocol !== "https:" ||
    publicAssetBaseUrl.pathname !== "/" ||
    publicAssetBaseUrl.search ||
    publicAssetBaseUrl.hash ||
    publicAssetBaseUrl.username ||
    publicAssetBaseUrl.password
  ) {
    throw new Error("R2_PUBLIC_ASSET_BASE_URL must be a valid HTTPS origin.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicAssetBaseUrl: publicAssetBaseUrl.origin,
  };
}

export function readSupabaseAuthConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseAuthConfiguration {
  const rawUrl = environment.VITE_SUPABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error("VITE_SUPABASE_URL is required.");
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(rawUrl);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid HTTPS URL.");
  }

  if (supabaseUrl.protocol !== "https:") {
    throw new Error("VITE_SUPABASE_URL must be a valid HTTPS URL.");
  }

  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required.");
  }

  const allowedEmails = normalizeEmailList(
    environment.AUTH_ALLOWED_EMAILS,
    "AUTH_ALLOWED_EMAILS",
    false,
  );
  const adminEmails = normalizeEmailList(
    environment.AUTH_ADMIN_EMAILS,
    "AUTH_ADMIN_EMAILS",
    true,
  );

  if (Array.from(adminEmails).some(email => !allowedEmails.has(email))) {
    throw new Error("AUTH_ADMIN_EMAILS must be a subset of AUTH_ALLOWED_EMAILS.");
  }

  return {
    supabaseUrl: supabaseUrl.origin,
    publishableKey,
    allowedEmails,
    adminEmails,
  };
}

export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  secretsEncryptionKey: process.env.SECRETS_ENCRYPTION_KEY ?? "",
};
