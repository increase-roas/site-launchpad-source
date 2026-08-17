import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import {
  fetchWithTimeout,
  RequestTimeoutError,
} from "../../shared/requestTimeout";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../../shared/_core/errors";
import {
  upsertUser,
  type UserSyncInput,
} from "../db";
import {
  readSupabaseAuthConfiguration,
  type SupabaseAuthConfiguration,
} from "./env";
import { observeRuntimeOperation } from "./operationTelemetry";

export type AuthUserSyncInput = UserSyncInput;
export type AuthenticatedUser = User;
export const SUPABASE_TOKEN_TIMEOUT_MS = 10_000;

export type SupabaseAuthDependencies = {
  environment: NodeJS.ProcessEnv;
  verifyToken: (
    token: string,
    configuration: SupabaseAuthConfiguration,
    signal: AbortSignal,
  ) => Promise<Record<string, unknown>>;
  synchronizeUser: (input: AuthUserSyncInput) => Promise<AuthenticatedUser>;
  now: () => Date;
};

let cachedVerifier:
  | {
      supabaseUrl: string;
      publishableKey: string;
      client: SupabaseClient;
    }
  | undefined;

function getVerifierClient(
  configuration: SupabaseAuthConfiguration,
): SupabaseClient {
  if (
    !cachedVerifier ||
    cachedVerifier.supabaseUrl !== configuration.supabaseUrl ||
    cachedVerifier.publishableKey !== configuration.publishableKey
  ) {
    cachedVerifier = {
      supabaseUrl: configuration.supabaseUrl,
      publishableKey: configuration.publishableKey,
      client: createClient(
        configuration.supabaseUrl,
        configuration.publishableKey,
        {
          auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
          },
          global: {
            fetch: (input, init) =>
              fetchWithTimeout(
                globalThis.fetch,
                input,
                init,
                SUPABASE_TOKEN_TIMEOUT_MS,
              ),
          },
        },
      ),
    };
  }
  return cachedVerifier.client;
}

async function verifyTokenWithSupabase(
  token: string,
  configuration: SupabaseAuthConfiguration,
  _signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const { data, error } = await getVerifierClient(
    configuration,
  ).auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("Supabase rejected the access token.");
  }
  return data.claims as Record<string, unknown>;
}

async function verifyTokenWithinDeadline(
  token: string,
  configuration: SupabaseAuthConfiguration,
  dependencies: SupabaseAuthDependencies,
): Promise<Record<string, unknown>> {
  const nativeTimeoutSignal = AbortSignal.timeout(
    SUPABASE_TOKEN_TIMEOUT_MS,
  );
  const deadlineController = new AbortController();
  const signal = AbortSignal.any([
    nativeTimeoutSignal,
    deadlineController.signal,
  ]);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new RequestTimeoutError(SUPABASE_TOKEN_TIMEOUT_MS);
      deadlineController.abort(error);
      reject(error);
    }, SUPABASE_TOKEN_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      dependencies.verifyToken(token, configuration, signal),
      deadline,
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function defaultDependencies(): SupabaseAuthDependencies {
  return {
    environment: process.env,
    verifyToken: verifyTokenWithSupabase,
    synchronizeUser: upsertUser,
    now: () => new Date(),
  };
}

function readBearerToken(request: Request): string {
  const authorization = request.headers.authorization;
  if (
    typeof authorization !== "string" ||
    !/^Bearer [^\s]+$/.test(authorization)
  ) {
    throw UnauthorizedError(
      "A valid Bearer Authorization header is required.",
    );
  }
  return authorization.slice("Bearer ".length);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readDisplayName(claims: Record<string, unknown>): string | null {
  const metadata = claims.user_metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const values = metadata as Record<string, unknown>;
  for (const key of ["full_name", "name"] as const) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function requireVerifiedClaims(
  claims: Record<string, unknown>,
  configuration: SupabaseAuthConfiguration,
  now: Date,
): {
  authUserId: string;
  email: string;
  name: string | null;
} {
  const expectedIssuer = `${configuration.supabaseUrl}/auth/v1`;
  if (claims.iss !== expectedIssuer) {
    throw UnauthorizedError("Access token issuer is invalid.");
  }

  const audience = claims.aud;
  const hasAuthenticatedAudience =
    audience === "authenticated" ||
    (Array.isArray(audience) && audience.includes("authenticated"));
  if (!hasAuthenticatedAudience) {
    throw UnauthorizedError("Access token audience is invalid.");
  }

  if (
    typeof claims.exp !== "number" ||
    claims.exp <= Math.floor(now.getTime() / 1000)
  ) {
    throw UnauthorizedError("Access token is expired.");
  }

  if (
    typeof claims.sub !== "string" ||
    !UUID_PATTERN.test(claims.sub)
  ) {
    throw UnauthorizedError("Access token subject is invalid.");
  }

  if (typeof claims.email !== "string" || !claims.email.trim()) {
    throw UnauthorizedError("Access token email is invalid.");
  }

  return {
    authUserId: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: readDisplayName(claims),
  };
}

export async function authenticateSupabaseRequest(
  request: Request,
  dependencies: SupabaseAuthDependencies = defaultDependencies(),
): Promise<AuthenticatedUser> {
  const token = readBearerToken(request);
  const configuration = readSupabaseAuthConfiguration(
    dependencies.environment,
  );

  let claims: Record<string, unknown>;
  try {
    claims = await observeRuntimeOperation(
      "token_verification",
      () => verifyTokenWithinDeadline(
        token,
        configuration,
        dependencies,
      ),
    );
  } catch {
    throw UnauthorizedError("Invalid access token.");
  }

  const identity = requireVerifiedClaims(
    claims,
    configuration,
    dependencies.now(),
  );
  if (!configuration.allowedEmails.has(identity.email)) {
    throw ForbiddenError("This Google account is not approved.");
  }

  const role = configuration.adminEmails.has(identity.email)
    ? "admin"
    : "user";
  return observeRuntimeOperation(
    "user_synchronization",
    () => dependencies.synchronizeUser({
      authUserId: identity.authUserId,
      email: identity.email,
      name: identity.name,
      loginMethod: "google",
      role,
      lastSignedIn: dependencies.now(),
    }),
  );
}
