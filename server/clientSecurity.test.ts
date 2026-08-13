import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSetupValue, encryptSetupValue, hasProtectedValue } from "./clientSecurity";

const originalSecret = process.env.JWT_SECRET;
const originalDedicated = process.env.SECRETS_ENCRYPTION_KEY;
const originalNodeEnv = process.env.NODE_ENV;

function encryptLegacyV1(value: string, jwtSecret: string): string {
  const key = createHash("sha256").update(jwtSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

describe("protected setup values", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    process.env.SECRETS_ENCRYPTION_KEY = "dedicated-test-encryption-key";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.SECRETS_ENCRYPTION_KEY = originalDedicated;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("encrypts values with the dedicated key and recovers them", () => {
    const encrypted = encryptSetupValue("secret-value-123");
    expect(encrypted.startsWith("v2.")).toBe(true);
    expect(encrypted).not.toContain("secret-value-123");
    expect(hasProtectedValue(encrypted)).toBe(true);
    expect(decryptSetupValue(encrypted)).toBe("secret-value-123");
  });

  it("uses a fresh initialization vector for each saved value", () => {
    const first = encryptSetupValue("same-value");
    const second = encryptSetupValue("same-value");
    expect(first).not.toBe(second);
  });

  it("still decrypts legacy JWT-derived v1 ciphertext", () => {
    const legacy = encryptLegacyV1("legacy-secret", "test-only-secret-that-is-long-enough");
    expect(hasProtectedValue(legacy)).toBe(true);
    expect(decryptSetupValue(legacy)).toBe("legacy-secret");
  });

  it("keeps v2 readable after JWT_SECRET rotation", () => {
    const encrypted = encryptSetupValue("stable-secret");
    process.env.JWT_SECRET = "rotated-jwt-secret-that-is-long-enough";
    expect(decryptSetupValue(encrypted)).toBe("stable-secret");
  });

  it("throws in production when the dedicated key is missing", () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    expect(() => encryptSetupValue("secret-value-123")).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
});
