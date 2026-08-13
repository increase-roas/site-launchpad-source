import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSetupValue, encryptSetupValue, hasProtectedValue } from "./clientSecurity";

const originalSecret = process.env.JWT_SECRET;

describe("protected setup values", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("encrypts values before persistence and can recover them server-side", () => {
    const encrypted = encryptSetupValue("secret-value-123");
    expect(encrypted).not.toContain("secret-value-123");
    expect(hasProtectedValue(encrypted)).toBe(true);
    expect(decryptSetupValue(encrypted)).toBe("secret-value-123");
  });

  it("uses a fresh initialization vector for each saved value", () => {
    const first = encryptSetupValue("same-value");
    const second = encryptSetupValue("same-value");
    expect(first).not.toBe(second);
  });
});
