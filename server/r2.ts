import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  readR2Configuration,
  type R2Configuration,
} from "./_core/env";

export { readR2Configuration };
export type { R2Configuration };

export const MAX_PRESIGN_EXPIRY_SECONDS = 600;

type SignUrl = typeof getSignedUrl;

export function createR2ClientOptions(config: R2Configuration): S3ClientConfig {
  return {
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
}

export function createR2Client(config: R2Configuration): S3Client {
  return new S3Client(createR2ClientOptions(config));
}

export async function createPresignedUpload(
  config: R2Configuration,
  client: S3Client,
  input: { key: string; contentType: string; expiresInSeconds?: number },
  signUrl: SignUrl = getSignedUrl,
): Promise<string> {
  const expiresIn = Math.min(
    input.expiresInSeconds ?? MAX_PRESIGN_EXPIRY_SECONDS,
    MAX_PRESIGN_EXPIRY_SECONDS,
  );
  return signUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
    {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    },
  );
}

export type R2ObjectStore = {
  createPresignedPut(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  headObject(key: string): Promise<{ contentLength: number } | null>;
  getObjectBuffer(key: string, expectedLength: number): Promise<Buffer>;
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  deleteObject(key: string): Promise<void>;
};

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return error.name === "NotFound" || error.name === "NoSuchKey";
}

export function createR2ObjectStore(
  config: R2Configuration,
  client: S3Client = createR2Client(config),
): R2ObjectStore {
  return {
    createPresignedPut: input => createPresignedUpload(config, client, input),
    async headObject(key) {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        return typeof result.ContentLength === "number"
          ? { contentLength: result.ContentLength }
          : null;
      } catch (error) {
        if (isMissingObjectError(error)) return null;
        throw error;
      }
    },
    async getObjectBuffer(key, expectedLength) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Range: `bytes=0-${expectedLength - 1}`,
        }),
      );
      if (!result.Body) throw new Error("R2 object body is missing.");
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
        }),
      );
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
