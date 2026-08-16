import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateSupabaseRequest,
  type AuthUserSyncInput,
  type SupabaseAuthDependencies,
} from "./supabaseAuth";

const subject = "123e4567-e89b-12d3-a456-426614174000";
const now = new Date("2026-08-15T00:00:00.000Z");

const baseEnvironment: NodeJS.ProcessEnv = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com, operator@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
};

const validClaims = {
  sub: subject,
  email: "operator@example.com",
  iss: "https://project-ref.supabase.co/auth/v1",
  aud: "authenticated",
  exp: 2_000_000_000,
  user_metadata: { full_name: "Site Operator" },
};

function requestWithAuthorization(
  authorization?: string,
): Request {
  return {
    headers: authorization ? { authorization } : {},
  } as Request;
}

function createDependencies(
  overrides: Partial<SupabaseAuthDependencies> = {},
): SupabaseAuthDependencies {
  return {
    environment: baseEnvironment,
    verifyToken: vi.fn(async () => validClaims),
    synchronizeUser: vi.fn(async (input: AuthUserSyncInput) => ({
      id: 1,
      ...input,
      createdAt: now,
      updatedAt: now,
    })),
    now: () => now,
    ...overrides,
  };
}

describe("Supabase request authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing Authorization header before verification or database access", async () => {
    const dependencies = createDependencies();

    await expect(
      authenticateSupabaseRequest(requestWithAuthorization(), dependencies),
    ).rejects.toThrow(/authorization/i);
    expect(dependencies.verifyToken).not.toHaveBeenCalled();
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it.each([
    "Basic token",
    "Bearer",
    "Bearer token extra",
    "bearer token",
  ])("rejects malformed Authorization value %s", async authorization => {
    const dependencies = createDependencies();

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization(authorization),
        dependencies,
      ),
    ).rejects.toThrow(/authorization/i);
    expect(dependencies.verifyToken).not.toHaveBeenCalled();
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it.each(["forged", "expired"])(
    "rejects a %s JWT when cryptographic verification fails",
    async reason => {
      const dependencies = createDependencies({
        verifyToken: vi.fn(async () => {
          throw new Error(`${reason} token`);
        }),
      });

      await expect(
        authenticateSupabaseRequest(
          requestWithAuthorization("Bearer invalid-token"),
          dependencies,
        ),
      ).rejects.toThrow(/invalid access token/i);
      expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
    },
  );

  it("rejects a token from the wrong Supabase issuer or project", async () => {
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        iss: "https://other-project.supabase.co/auth/v1",
      })),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/issuer/i);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("rejects a verified token without sub", async () => {
    const claimsWithoutSubject: Record<string, unknown> = {
      ...validClaims,
    };
    delete claimsWithoutSubject.sub;
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => claimsWithoutSubject),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/subject/i);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("rejects a verified token without email", async () => {
    const claimsWithoutEmail: Record<string, unknown> = {
      ...validClaims,
    };
    delete claimsWithoutEmail.email;
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => claimsWithoutEmail),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/email/i);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("rejects an unapproved exact email before database synchronization", async () => {
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: "outsider@example.com",
      })),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/approved/i);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("rejects a domain lookalike instead of using suffix authorization", async () => {
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: "operator@example.com.attacker.test",
      })),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/approved/i);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("normalizes token email case and configuration whitespace", async () => {
    const dependencies = createDependencies({
      environment: {
        ...baseEnvironment,
        AUTH_ALLOWED_EMAILS: " Operator@Example.com , owner@example.com ",
        AUTH_ADMIN_EMAILS: " owner@example.com ",
      },
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: " OPERATOR@EXAMPLE.COM ",
      })),
    });

    const user = await authenticateSupabaseRequest(
      requestWithAuthorization("Bearer signed-token"),
      dependencies,
    );

    expect(user.email).toBe("operator@example.com");
  });

  it("accepts an allowlisted email and synchronizes the verified identity", async () => {
    const dependencies = createDependencies();

    const user = await authenticateSupabaseRequest(
      requestWithAuthorization("Bearer signed-token"),
      dependencies,
    );

    expect(user).toMatchObject({
      authUserId: subject,
      email: "operator@example.com",
      name: "Site Operator",
      loginMethod: "google",
      role: "user",
      lastSignedIn: now,
    });
    expect(dependencies.synchronizeUser).toHaveBeenCalledTimes(1);
  });

  it("assigns admin only to an exact admin email", async () => {
    const dependencies = createDependencies({
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: "owner@example.com",
      })),
    });

    const user = await authenticateSupabaseRequest(
      requestWithAuthorization("Bearer signed-token"),
      dependencies,
    );

    expect(user.role).toBe("admin");
  });

  it("downgrades a removed admin to user on the next request", async () => {
    const synchronizeUser = vi.fn(async (input: AuthUserSyncInput) => ({
      id: 1,
      ...input,
      createdAt: now,
      updatedAt: now,
    }));
    const adminDependencies = createDependencies({
      synchronizeUser,
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: "owner@example.com",
      })),
    });
    const downgradedDependencies = createDependencies({
      synchronizeUser,
      environment: {
        ...baseEnvironment,
        AUTH_ADMIN_EMAILS: "",
      },
      verifyToken: vi.fn(async () => ({
        ...validClaims,
        email: "owner@example.com",
      })),
    });

    await authenticateSupabaseRequest(
      requestWithAuthorization("Bearer first-token"),
      adminDependencies,
    );
    await authenticateSupabaseRequest(
      requestWithAuthorization("Bearer second-token"),
      downgradedDependencies,
    );

    expect(synchronizeUser.mock.calls.map(([input]) => input.role)).toEqual([
      "admin",
      "user",
    ]);
  });

  it("fails closed for an empty allowed-email configuration", async () => {
    const dependencies = createDependencies({
      environment: {
        ...baseEnvironment,
        AUTH_ALLOWED_EMAILS: "",
      },
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/AUTH_ALLOWED_EMAILS/);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("fails configuration when an admin is outside the allowed list", async () => {
    const dependencies = createDependencies({
      environment: {
        ...baseEnvironment,
        AUTH_ADMIN_EMAILS: "outsider@example.com",
      },
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/AUTH_ADMIN_EMAILS/);
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it("denies the request when database synchronization fails", async () => {
    const dependencies = createDependencies({
      synchronizeUser: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    await expect(
      authenticateSupabaseRequest(
        requestWithAuthorization("Bearer signed-token"),
        dependencies,
      ),
    ).rejects.toThrow(/authentication failed/i);
  });
});
