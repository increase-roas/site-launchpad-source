import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  SUPPORTED_IMAGE_MIME_TYPES,
  MAX_RAW_UPLOAD_BYTES,
} from "../../shared/assetUpload";
import { ASTRO_ASSET_SLOT_VALUES } from "../../shared/astroConfig";
import { ASSET_SLOT_VALUES } from "../../shared/client";
import { LIBRARY_UPLOAD_SLOT } from "../../shared/mediaLibrary";
import { mediaSpecificationForAsset } from "../../shared/mediaSpecifications";
import {
  AssetUploadError,
  getDefaultAssetUploadService,
  type CompletedAssetUpload,
  type RequestAssetUploadInput,
} from "../assetUploads";
import {
  assignMediaLibraryItem,
  clearMediaSlot,
  deleteMediaLibraryItem,
  listMediaLibrary,
  updateMediaLibraryItem,
} from "../mediaLibraryDb";
import {
  type MediaLibraryItemDto,
  type MediaLibraryPlacementKind,
} from "../mediaLibrary";
import { deriveRuntimeMode, readAssetStorageDriver } from "../_core/env";
import { getDevelopmentAssetStore } from "../developmentAssetStore";
import { createR2ObjectStore, readR2Configuration } from "../r2";
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
  z.object({
    ...commonRequestFields,
    assetKind: z.literal("library"),
    slot: z.literal(LIBRARY_UPLOAD_SLOT),
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

const clientIdInput = z.object({
  clientId: z.number().int().positive(),
}).strict();

const libraryItemInput = z.object({
  clientId: z.number().int().positive(),
  itemId: z.number().int().positive(),
}).strict();

const placementInput = z.discriminatedUnion("assetKind", [
  z.object({
    clientId: z.number().int().positive(),
    itemId: z.number().int().positive(),
    assetKind: z.literal("client"),
    slot: z.enum(ASSET_SLOT_VALUES),
  }).strict(),
  z.object({
    clientId: z.number().int().positive(),
    itemId: z.number().int().positive(),
    assetKind: z.literal("astro"),
    slot: z.enum(ASTRO_ASSET_SLOT_VALUES),
  }).strict(),
]);

const clearSlotInput = z.discriminatedUnion("assetKind", [
  z.object({
    clientId: z.number().int().positive(),
    assetKind: z.literal("client"),
    slot: z.enum(ASSET_SLOT_VALUES),
  }).strict(),
  z.object({
    clientId: z.number().int().positive(),
    assetKind: z.literal("astro"),
    slot: z.enum(ASTRO_ASSET_SLOT_VALUES),
  }).strict(),
]);

export type AssetUploadOperations = {
  requestUpload(input: RequestAssetUploadInput): Promise<{
    uploadId: string;
    uploadUrl: string;
    requiredHeaders: { "Content-Type": string };
    expiresAt: Date;
  }>;
  completeUpload(uploadId: string): Promise<CompletedAssetUpload>;
};

export type AssetLibraryOperations = {
  listLibrary(clientId: number): Promise<MediaLibraryItemDto[]>;
  updateLibraryItem(input: {
    clientId: number;
    itemId: number;
    alt: string;
    description: string;
  }): Promise<MediaLibraryItemDto>;
  deleteLibraryItem(input: {
    clientId: number;
    itemId: number;
  }): Promise<{ storageKey: string }>;
  assignLibraryItem(input: {
    clientId: number;
    itemId: number;
    assetKind: MediaLibraryPlacementKind;
    slot: string;
  }): Promise<MediaLibraryItemDto>;
  clearSlot(input: {
    clientId: number;
    assetKind: MediaLibraryPlacementKind;
    slot: string;
  }): Promise<void>;
  deleteStoredObject(key: string): Promise<void>;
};

const defaultOperations: AssetUploadOperations = {
  requestUpload: input => getDefaultAssetUploadService().requestUpload(input),
  completeUpload: uploadId => getDefaultAssetUploadService().completeUpload(uploadId),
};

async function defaultDeleteStoredObject(key: string): Promise<void> {
  if (readAssetStorageDriver(deriveRuntimeMode()) === "local") {
    await getDevelopmentAssetStore().store.deleteObject(key);
    return;
  }
  await createR2ObjectStore(readR2Configuration()).deleteObject(key);
}

const defaultLibraryOperations: AssetLibraryOperations = {
  listLibrary: listMediaLibrary,
  updateLibraryItem: updateMediaLibraryItem,
  deleteLibraryItem: deleteMediaLibraryItem,
  assignLibraryItem: assignMediaLibraryItem,
  clearSlot: clearMediaSlot,
  deleteStoredObject: defaultDeleteStoredObject,
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

function mapLibraryError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof Error) {
    if (error.message === "Image not found." || error.message === "Client not found.") {
      throw new TRPCError({ code: "NOT_FOUND", message: error.message });
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "The image library could not be updated.",
  });
}

export function createAssetsRouter(
  operations: AssetUploadOperations = defaultOperations,
  libraryOperations: AssetLibraryOperations = defaultLibraryOperations,
) {
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
    listLibrary: protectedProcedure
      .input(clientIdInput)
      .query(async ({ input }) => {
        try {
          return { items: await libraryOperations.listLibrary(input.clientId) };
        } catch (error) {
          return mapLibraryError(error);
        }
      }),
    updateLibraryItem: protectedProcedure
      .input(libraryItemInput.extend({
        alt: z.string().max(240),
        description: z.string().max(2000),
      }))
      .mutation(async ({ input }) => {
        try {
          return await libraryOperations.updateLibraryItem(input);
        } catch (error) {
          return mapLibraryError(error);
        }
      }),
    deleteLibraryItem: protectedProcedure
      .input(libraryItemInput)
      .mutation(async ({ input }) => {
        try {
          const deleted = await libraryOperations.deleteLibraryItem(input);
          await libraryOperations.deleteStoredObject(deleted.storageKey).catch(() => undefined);
          return { ok: true as const };
        } catch (error) {
          return mapLibraryError(error);
        }
      }),
    assignLibraryItem: protectedProcedure
      .input(placementInput)
      .mutation(async ({ input }) => {
        try {
          return await libraryOperations.assignLibraryItem(input);
        } catch (error) {
          return mapLibraryError(error);
        }
      }),
    clearSlot: protectedProcedure
      .input(clearSlotInput)
      .mutation(async ({ input }) => {
        try {
          await libraryOperations.clearSlot(input);
          return { ok: true as const };
        } catch (error) {
          return mapLibraryError(error);
        }
      }),
  });
}

export const assetsRouter = createAssetsRouter();
