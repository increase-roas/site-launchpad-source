import { createHash, randomUUID } from "node:crypto";
import type {
  AssetUploadSession,
  InsertAssetUploadSession,
  InsertClientAsset,
} from "../drizzle/schema";
import {
  ASSET_KIND_VALUES,
  MAX_RAW_UPLOAD_BYTES,
  isSupportedImageMimeType,
  type AssetKind,
  type SupportedImageMimeType,
} from "../shared/assetUpload";
import {
  ASTRO_ASSET_FILENAMES,
  ASTRO_ASSET_SLOT_VALUES,
  type AstroAssetSlot,
} from "../shared/astroConfig";
import {
  ASSET_SLOT_FILENAMES,
  ASSET_SLOT_VALUES,
  sanitizeClientFolder,
  type AssetSlot,
} from "../shared/client";
import {
  inspectSupportedImageMimeType,
  processAstroUploadedImage,
  processUploadedImage,
  type ProcessedImage,
} from "./imageProcessing";
import { assetUploadPersistence } from "./assetUploadDb";
import {
  MAX_PRESIGN_EXPIRY_SECONDS,
  createR2ObjectStore,
  readR2Configuration,
} from "./r2";

export { MAX_RAW_UPLOAD_BYTES };

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const CLIENT_SLOT_SET = new Set<string>(ASSET_SLOT_VALUES);
const ASTRO_SLOT_SET = new Set<string>(ASTRO_ASSET_SLOT_VALUES);

export type AssetUploadSessionRecord = AssetUploadSession;

export type RequestAssetUploadInput = {
  clientId: number;
  assetKind: AssetKind;
  slot: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type CompletedAssetUpload = {
  clientId: number;
  assetKind: AssetKind;
  asset: InsertClientAsset;
};

export type AssetUploadServiceDependencies = {
  now(): Date;
  randomUUID(): string;
  publicAssetBaseUrl: string;
  getClientById(clientId: number): Promise<{ id: number; shortName: string } | undefined>;
  createUploadSession(values: InsertAssetUploadSession): Promise<void>;
  getUploadSession(uploadId: string): Promise<AssetUploadSessionRecord | undefined>;
  markUploadSessionFailed(uploadId: string): Promise<void>;
  createPresignedPut(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  headObject(key: string): Promise<{ contentLength: number } | null>;
  getObjectBuffer(key: string, expectedLength: number): Promise<Buffer>;
  inspectImageMimeType(buffer: Buffer): Promise<SupportedImageMimeType>;
  processClientImage(buffer: Buffer, slot: AssetSlot): Promise<ProcessedImage>;
  processAstroImage(buffer: Buffer, slot: AstroAssetSlot): Promise<ProcessedImage>;
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  deleteObject(key: string): Promise<void>;
  finalizeUpload(input: {
    uploadId: string;
    asset: InsertClientAsset;
    completedAt: Date;
  }): Promise<{ previousStorageKey: string | null }>;
};

export class AssetUploadError extends Error {
  constructor(
    message: string,
    readonly code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_SERVER_ERROR",
  ) {
    super(message);
    this.name = "AssetUploadError";
  }
}

function isValidSlot(assetKind: AssetKind, slot: string): boolean {
  return assetKind === "client" ? CLIENT_SLOT_SET.has(slot) : ASTRO_SLOT_SET.has(slot);
}

function expectedTemporaryKey(session: AssetUploadSessionRecord): string {
  return `tmp/${session.clientId}/${session.id}`;
}

function publicAssetUrl(baseUrl: string, key: string): string {
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedPath}`;
}

async function failSession(
  dependencies: AssetUploadServiceDependencies,
  uploadId: string,
  message: string,
): Promise<never> {
  await dependencies.markUploadSessionFailed(uploadId).catch(() => undefined);
  throw new AssetUploadError(message, "BAD_REQUEST");
}

function validateRequest(input: RequestAssetUploadInput): {
  originalFilename: string;
  mimeType: SupportedImageMimeType;
} {
  if (!(ASSET_KIND_VALUES as readonly string[]).includes(input.assetKind)) {
    throw new AssetUploadError("Choose a valid asset type.", "BAD_REQUEST");
  }
  if (!isValidSlot(input.assetKind, input.slot)) {
    throw new AssetUploadError("Choose a valid image slot for this asset type.", "BAD_REQUEST");
  }
  const originalFilename = input.originalFilename.trim();
  if (!originalFilename || originalFilename.length > 500) {
    throw new AssetUploadError("Choose an image with a valid filename.", "BAD_REQUEST");
  }
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!isSupportedImageMimeType(mimeType)) {
    throw new AssetUploadError(
      "Use a JPG, PNG, WebP, AVIF, TIFF, or GIF image.",
      "BAD_REQUEST",
    );
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new AssetUploadError("That image appears to be empty.", "BAD_REQUEST");
  }
  if (input.sizeBytes > MAX_RAW_UPLOAD_BYTES) {
    throw new AssetUploadError(
      "That image is too large. Choose one smaller than 20 MB.",
      "BAD_REQUEST",
    );
  }
  return { originalFilename, mimeType };
}

export function createAssetUploadService(dependencies: AssetUploadServiceDependencies) {
  return {
    async requestUpload(input: RequestAssetUploadInput) {
      const validated = validateRequest(input);
      const client = await dependencies.getClientById(input.clientId);
      if (!client) throw new AssetUploadError("Client not found.", "NOT_FOUND");

      const uploadId = dependencies.randomUUID();
      const tempKey = `tmp/${client.id}/${uploadId}`;
      const expiresAt = new Date(
        dependencies.now().getTime() + MAX_PRESIGN_EXPIRY_SECONDS * 1000,
      );
      await dependencies.createUploadSession({
        id: uploadId,
        clientId: client.id,
        assetKind: input.assetKind,
        slot: input.slot,
        originalFilename: validated.originalFilename,
        declaredMimeType: validated.mimeType,
        declaredSizeBytes: input.sizeBytes,
        tempKey,
        status: "pending",
        expiresAt,
      });

      let uploadUrl: string;
      try {
        uploadUrl = await dependencies.createPresignedPut({
          key: tempKey,
          contentType: validated.mimeType,
          expiresInSeconds: MAX_PRESIGN_EXPIRY_SECONDS,
        });
      } catch {
        await dependencies.markUploadSessionFailed(uploadId).catch(() => undefined);
        throw new AssetUploadError(
          "The upload could not be prepared. Try again.",
          "INTERNAL_SERVER_ERROR",
        );
      }

      return {
        uploadId,
        uploadUrl,
        requiredHeaders: { "Content-Type": validated.mimeType },
        expiresAt,
      };
    },

    async completeUpload(uploadId: string): Promise<CompletedAssetUpload> {
      const session = await dependencies.getUploadSession(uploadId);
      if (!session) {
        throw new AssetUploadError("Upload session not found.", "NOT_FOUND");
      }
      if (session.status === "completed") {
        throw new AssetUploadError("This upload was already completed.", "CONFLICT");
      }
      if (session.status === "failed") {
        throw new AssetUploadError("This upload can no longer be completed.", "CONFLICT");
      }
      if (session.expiresAt.getTime() <= dependencies.now().getTime()) {
        throw new AssetUploadError("This upload has expired. Choose the image again.", "CONFLICT");
      }
      if (
        session.tempKey !== expectedTemporaryKey(session) ||
        !isValidSlot(session.assetKind, session.slot) ||
        !isSupportedImageMimeType(session.declaredMimeType)
      ) {
        throw new AssetUploadError("Upload session is invalid.", "BAD_REQUEST");
      }

      let head: { contentLength: number } | null;
      try {
        head = await dependencies.headObject(session.tempKey);
      } catch {
        throw new AssetUploadError(
          "The uploaded file could not be checked. Try again.",
          "INTERNAL_SERVER_ERROR",
        );
      }
      if (!head) {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file could not be found. Choose the image again.",
        );
      }
      if (
        !Number.isInteger(head.contentLength) ||
        head.contentLength <= 0 ||
        head.contentLength > MAX_RAW_UPLOAD_BYTES ||
        head.contentLength !== session.declaredSizeBytes
      ) {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file size does not match the requested upload.",
        );
      }

      let source: Buffer;
      try {
        source = await dependencies.getObjectBuffer(
          session.tempKey,
          head.contentLength,
        );
      } catch {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file could not be read. Choose the image again.",
        );
      }
      if (source.length !== head.contentLength) {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file size does not match the requested upload.",
        );
      }

      let actualMimeType: SupportedImageMimeType;
      try {
        actualMimeType = await dependencies.inspectImageMimeType(source);
      } catch {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file is not a valid supported image.",
        );
      }
      if (actualMimeType !== session.declaredMimeType) {
        return failSession(
          dependencies,
          uploadId,
          "The uploaded file type does not match the requested upload.",
        );
      }

      let processed: ProcessedImage;
      try {
        processed =
          session.assetKind === "client"
            ? await dependencies.processClientImage(source, session.slot as AssetSlot)
            : await dependencies.processAstroImage(source, session.slot as AstroAssetSlot);
      } catch {
        return failSession(
          dependencies,
          uploadId,
          "That image could not be processed. Choose a different image.",
        );
      }

      const client = await dependencies.getClientById(session.clientId);
      if (!client) {
        return failSession(dependencies, uploadId, "Client not found.");
      }
      const folder = sanitizeClientFolder(client.shortName) || `client-${client.id}`;
      const scope = session.assetKind === "client" ? "assets" : "astro";
      const contentHash = createHash("sha256").update(processed.buffer).digest("hex");
      const version = dependencies.randomUUID().replace(/-/g, "");
      const permanentKey =
        `clients/${client.id}-${folder}/${scope}/${session.slot}-${contentHash}-${version}.webp`;
      const filename =
        session.assetKind === "client"
          ? ASSET_SLOT_FILENAMES[session.slot as AssetSlot]
          : ASTRO_ASSET_FILENAMES[session.slot as AstroAssetSlot];
      const asset: InsertClientAsset = {
        clientId: client.id,
        slot: session.slot as InsertClientAsset["slot"],
        storageKey: permanentKey,
        storageUrl: publicAssetUrl(dependencies.publicAssetBaseUrl, permanentKey),
        filename,
        originalFilename: session.originalFilename,
        mimeType: processed.mimeType,
        byteSize: processed.byteSize,
        width: processed.width,
        height: processed.height,
      };

      try {
        await dependencies.putObject({
          key: permanentKey,
          body: processed.buffer,
          contentType: "image/webp",
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
      } catch {
        return failSession(
          dependencies,
          uploadId,
          "The processed image could not be stored. Try again.",
        );
      }

      let previousStorageKey: string | null;
      try {
        ({ previousStorageKey } = await dependencies.finalizeUpload({
          uploadId,
          asset,
          completedAt: dependencies.now(),
        }));
      } catch {
        await dependencies.deleteObject(permanentKey).catch(() => undefined);
        throw new AssetUploadError(
          "The image upload could not be finalized. Try again.",
          "INTERNAL_SERVER_ERROR",
        );
      }

      await dependencies.deleteObject(session.tempKey).catch(() => undefined);
      if (previousStorageKey && previousStorageKey !== permanentKey) {
        await dependencies.deleteObject(previousStorageKey).catch(() => undefined);
      }

      return { clientId: client.id, assetKind: session.assetKind, asset };
    },
  };
}

let defaultService: ReturnType<typeof createAssetUploadService> | undefined;

export function getDefaultAssetUploadService(): ReturnType<typeof createAssetUploadService> {
  if (defaultService) return defaultService;
  const config = readR2Configuration();
  const objectStore = createR2ObjectStore(config);
  defaultService = createAssetUploadService({
    now: () => new Date(),
    randomUUID,
    publicAssetBaseUrl: config.publicAssetBaseUrl,
    ...assetUploadPersistence,
    ...objectStore,
    inspectImageMimeType: inspectSupportedImageMimeType,
    processClientImage: processUploadedImage,
    processAstroImage: processAstroUploadedImage,
  });
  return defaultService;
}
