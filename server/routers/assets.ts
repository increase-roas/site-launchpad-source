import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  SUPPORTED_IMAGE_MIME_TYPES,
  MAX_RAW_UPLOAD_BYTES,
} from "../../shared/assetUpload";
import { ASTRO_ASSET_SLOT_VALUES } from "../../shared/astroConfig";
import { ASSET_SLOT_VALUES } from "../../shared/client";
import { mediaSpecificationForAsset } from "../../shared/mediaSpecifications";
import {
  AssetUploadError,
  getDefaultAssetUploadService,
  type CompletedAssetUpload,
  type RequestAssetUploadInput,
} from "../assetUploads";
import { protectedProcedure, router } from "../_core/trpc";

const commonRequestFields = {
  clientId: z.number().int().positive(),
  originalFilename: z.string().trim().min(1).max(500),
  mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_RAW_UPLOAD_BYTES),
};

const requestUploadInput = z.discriminatedUnion("assetKind", [
  z.object({
    ...commonRequestFields,
    assetKind: z.literal("client"),
    slot: z.enum(ASSET_SLOT_VALUES),
  }).strict(),
  z.object({
    ...commonRequestFields,
    assetKind: z.literal("astro"),
    slot: z.enum(ASTRO_ASSET_SLOT_VALUES),
  }).strict(),
]).superRefine((input, context) => {
  const specification = mediaSpecificationForAsset(input.assetKind, input.slot);
  if (!specification.mimeTypes.includes(input.mimeType)) {
    context.addIssue({ code: "custom", path: ["mimeType"], message: specification.label });
  }
  if (input.sizeBytes > specification.maxBytes) {
    context.addIssue({ code: "custom", path: ["sizeBytes"], message: specification.label });
  }
});

const completeUploadInput = z.object({
  uploadId: z.string().uuid(),
}).strict();

export type AssetUploadOperations = {
  requestUpload(input: RequestAssetUploadInput): Promise<{
    uploadId: string;
    uploadUrl: string;
    requiredHeaders: { "Content-Type": string };
    expiresAt: Date;
  }>;
  completeUpload(uploadId: string): Promise<CompletedAssetUpload>;
};

const defaultOperations: AssetUploadOperations = {
  requestUpload: input => getDefaultAssetUploadService().requestUpload(input),
  completeUpload: uploadId => getDefaultAssetUploadService().completeUpload(uploadId),
};

function mapAssetUploadError(error: unknown): never {
  if (error instanceof AssetUploadError) {
    throw new TRPCError({ code: error.code, message: error.message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "The image upload could not be completed. Try again.",
  });
}

export function createAssetsRouter(operations: AssetUploadOperations = defaultOperations) {
  return router({
    requestUpload: protectedProcedure
      .input(requestUploadInput)
      .mutation(async ({ input }) => {
        try {
          return await operations.requestUpload(input);
        } catch (error) {
          return mapAssetUploadError(error);
        }
      }),
    completeUpload: protectedProcedure
      .input(completeUploadInput)
      .mutation(async ({ input }) => {
        try {
          return await operations.completeUpload(input.uploadId);
        } catch (error) {
          return mapAssetUploadError(error);
        }
      }),
  });
}

export const assetsRouter = createAssetsRouter();
