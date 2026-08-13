import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const LEGACY_VERSION = "v1";
const CURRENT_VERSION = "v2";

function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function jwtDerivedKey(): Buffer {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("Server encryption is not configured.");
  }
  return hashSecret(secret);
}

function dedicatedKey(): Buffer {
  const dedicated = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (dedicated) return hashSecret(dedicated);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRETS_ENCRYPTION_KEY is not configured.");
  }
  return jwtDerivedKey();
}

function encryptWithKey(value: string, key: Buffer, version: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [version, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(
    ".",
  );
}

function decryptWithKey(parts: { iv: string; authTag: string; encrypted: string }, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parts.authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts.encrypted, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

export function encryptSetupValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Cannot protect an empty value.");
  return encryptWithKey(normalized, dedicatedKey(), CURRENT_VERSION);
}

export function decryptSetupValue(value: string): string {
  const [version, ivValue, authTagValue, encryptedValue] = value.split(".");
  if (!version || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Protected value is invalid.");
  }

  const parts = { iv: ivValue, authTag: authTagValue, encrypted: encryptedValue };
  if (version === CURRENT_VERSION) {
    return decryptWithKey(parts, dedicatedKey());
  }
  if (version === LEGACY_VERSION) {
    return decryptWithKey(parts, jwtDerivedKey());
  }
  throw new Error("Protected value is invalid.");
}

export function hasProtectedValue(value: string | null | undefined): boolean {
  return Boolean(value && (value.startsWith(`${CURRENT_VERSION}.`) || value.startsWith(`${LEGACY_VERSION}.`)));
}
