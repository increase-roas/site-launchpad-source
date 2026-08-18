import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_PRESIGN_EXPIRY_SECONDS,
  createPresignedUpload,
  createR2Client,
  createR2ClientOptions,
  createR2ObjectStore,
  readR2Configuration,
} from "./r2";

const validEnvironment: NodeJS.ProcessEnv = {
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "site-launchpad-assets",
  R2_PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
};

describe("Cloudflare R2 configuration", () => {
  it("uses the R2 S3 endpoint and auto region without exposing credentials", async () => {
    const config = readR2Configuration(validEnvironment);
    const options = createR2ClientOptions(config);

    expect(options.region).toBe("auto");
    expect(options.endpoint).toBe(
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    );
    expect(options.credentials).toEqual({
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });
    expect(JSON.stringify(config)).not.toContain("R2_SECRET_ACCESS_KEY");

    const client = createR2Client(config);
    await expect(client.config.region()).resolves.toBe("auto");
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      protocol: "https:",
    });
  });

  it.each([
    [{ ...validEnvironment, R2_ACCOUNT_ID: "unsafe.account" }, "R2_ACCOUNT_ID"],
    [{ ...validEnvironment, R2_BUCKET: "Unsafe_Bucket" }, "R2_BUCKET"],
    [
      { ...validEnvironment, R2_PUBLIC_ASSET_BASE_URL: "http://assets.example.com" },
      "R2_PUBLIC_ASSET_BASE_URL",
    ],
    [
      { ...validEnvironment, R2_PUBLIC_ASSET_BASE_URL: "https://assets.example.com/path" },
      "R2_PUBLIC_ASSET_BASE_URL",
    ],
  ])("rejects unsafe configuration without echoing values", (environment, field) => {
    expect(() => readR2Configuration(environment)).toThrow(field);
    try {
      readR2Configuration(environment);
    } catch (error) {
      expect(String(error)).not.toContain(String(environment[field]));
    }
  });
});

describe("R2 presigned uploads", () => {
  it("real SigV4 presigning binds Content-Type and host offline", async () => {
    const config = readR2Configuration(validEnvironment);
    const signedUrl = await createPresignedUpload(
      config,
      createR2Client(config),
      {
        key: "tmp/7/123e4567-e89b-12d3-a456-426614174000",
        contentType: "image/png",
      },
    );
    const parsed = new URL(signedUrl);
    const signedHeaders =
      parsed.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];

    expect(parsed.hostname).toBe(
      "site-launchpad-assets.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    );
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(signedHeaders).toEqual(
      expect.arrayContaining(["content-type", "host"]),
    );
  });

  it("signs only a content-type-bound PUT for at most ten minutes", async () => {
    const sign = vi.fn(async (_client, command: PutObjectCommand, options) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "site-launchpad-assets",
        Key: "tmp/7/123e4567-e89b-12d3-a456-426614174000",
        ContentType: "image/png",
      });
      expect(options).toEqual({
        expiresIn: MAX_PRESIGN_EXPIRY_SECONDS,
        signableHeaders: new Set(["content-type"]),
      });
      return "https://r2-upload.example.test/signed";
    });

    const result = await createPresignedUpload(
      readR2Configuration(validEnvironment),
      {} as never,
      {
        key: "tmp/7/123e4567-e89b-12d3-a456-426614174000",
        contentType: "image/png",
      },
      sign,
    );

    expect(MAX_PRESIGN_EXPIRY_SECONDS).toBeLessThanOrEqual(600);
    expect(result).toBe("https://r2-upload.example.test/signed");
    expect(sign).toHaveBeenCalledOnce();
  });

  it("bounds temporary-object GETs to the validated HEAD length", async () => {
    const send = vi.fn(async (command: GetObjectCommand) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: "site-launchpad-assets",
        Key: "tmp/7/upload-id",
        Range: "bytes=0-9",
      });
      return {
        Body: {
          transformToByteArray: async () => new Uint8Array(10),
        },
      };
    });
    const store = createR2ObjectStore(
      readR2Configuration(validEnvironment),
      { send } as never,
    );

    await expect(store.getObjectBuffer("tmp/7/upload-id", 10)).resolves.toHaveLength(10);
  });
});
