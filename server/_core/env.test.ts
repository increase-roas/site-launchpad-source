import { describe, expect, it } from "vitest";
import { validateRuntimeEnv } from "./env";

const validDevelopmentEnv: NodeJS.ProcessEnv = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com, operator@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
  JWT_SECRET: "legacy-decryption-test-key",
  DATABASE_URL: "postgresql://runtime.invalid/site-launchpad",
  BUILT_IN_FORGE_API_URL: "https://forge.invalid",
  BUILT_IN_FORGE_API_KEY: "forge-test-key",
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
