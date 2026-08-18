import { describe, expect, it } from "vitest";
import { validateRuntimeEnv } from "./env";

const validDevelopmentEnv: NodeJS.ProcessEnv = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com, operator@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
  JWT_SECRET: "legacy-decryption-test-key",
  DATABASE_URL: "postgresql://runtime.invalid/site-launchpad",
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "site-launchpad-assets",
  R2_PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
};

describe("Supabase authentication environment validation", () => {
  it("accepts a valid development configuration", () => {
    expect(() =>
      validateRuntimeEnv("development", validDevelopmentEnv),
    ).not.toThrow();
  });

  it("requires an HTTPS Supabase URL without exposing its value", () => {
    const invalidValue = "http://project-ref.supabase.co";
    let caught: unknown;

    try {
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        VITE_SUPABASE_URL: invalidValue,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : "";
    expect(message).toContain("VITE_SUPABASE_URL");
    expect(message).not.toContain(invalidValue);
  });

  it("fails closed when the allowed-email list is empty", () => {
    expect(() =>
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        AUTH_ALLOWED_EMAILS: "  ",
      }),
    ).toThrow(/AUTH_ALLOWED_EMAILS/);
  });

  it("rejects an admin email outside the allowed list", () => {
    expect(() =>
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        AUTH_ADMIN_EMAILS: "outsider@example.com",
      }),
    ).toThrow(/AUTH_ADMIN_EMAILS/);
  });

  it("normalizes case and surrounding configuration whitespace", () => {
    expect(() =>
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        AUTH_ALLOWED_EMAILS: " Owner@Example.com ,operator@example.com ",
        AUTH_ADMIN_EMAILS: " owner@example.COM ",
      }),
    ).not.toThrow();
  });

  it.each(["*@example.com", "@example.com", "example.com"])(
    "rejects non-exact allowed entry %s",
    entry => {
      expect(() =>
        validateRuntimeEnv("development", {
          ...validDevelopmentEnv,
          AUTH_ALLOWED_EMAILS: entry,
          AUTH_ADMIN_EMAILS: "",
        }),
      ).toThrow(/AUTH_ALLOWED_EMAILS/);
    },
  );
});

describe("R2 environment validation", () => {
  it.each([
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_ASSET_BASE_URL",
  ] as const)("requires %s in development", name => {
    expect(() =>
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        [name]: "",
      }),
    ).toThrow(name);
  });

  it("does not require Manus Forge credentials", () => {
    expect(() =>
      validateRuntimeEnv("development", validDevelopmentEnv),
    ).not.toThrow();
    expect(() =>
      validateRuntimeEnv("production", {
        ...validDevelopmentEnv,
        SECRETS_ENCRYPTION_KEY: "encryption-test-key",
      }),
    ).not.toThrow();
  });

  it("does not expose invalid R2 values in errors", () => {
    const invalidValue = "unsafe-secret-like-bucket_value";
    let caught: unknown;

    try {
      validateRuntimeEnv("development", {
        ...validDevelopmentEnv,
        R2_BUCKET: invalidValue,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : "";
    expect(message).toContain("R2_BUCKET");
    expect(message).not.toContain(invalidValue);
  });
});
