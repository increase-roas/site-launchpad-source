import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Server encryption is not configured.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSetupValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Cannot protect an empty value.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSetupValue(value: string): string {
  const [version, ivValue, authTagValue, encryptedValue] = value.split(".");
  if (version !== VERSION || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Protected value is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hasProtectedValue(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(`${VERSION}.`));
}
