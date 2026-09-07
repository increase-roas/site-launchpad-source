import { uploadAssetDirectly, type AssetUploadResult } from "@/lib/assetUpload";
import { trpc } from "@/lib/trpc";
import {
  imageUploadRejectionMessage,
  photosAddedToLibraryToast,
} from "@shared/assetUpload";
import type { AstroAssetSlot, AstroClientConfigInput } from "@shared/astroConfig";
import type { AssetSlot } from "@shared/client";
import { LIBRARY_UPLOAD_SLOT } from "@shared/mediaLibrary";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DevPlaceholderFillBar } from "./media/DevPlaceholderFillBar";
import { MediaWorkspace } from "./media/MediaWorkspace";
import {
  applyLibrarySlotImages,
  astroSlotId,
  buildMediaSlotCatalog,
  clientSlotId,
  resolveMediaSlots,
  type ResolvedMediaSlot,
  type StoredMediaImage,
} from "./media/mediaSlots";
import { useDevPlaceholderFill } from "./media/useDevPlaceholderFill";

type StoredImage = StoredMediaImage & { slot: string };

/** Bulk fills report their own progress, so per-upload toasts are suppressed. */
type UploadOptions = { quiet?: boolean };

/** Generated stand-in artwork is a development affordance and never ships. */
const PLACEHOLDER_FILL_AVAILABLE = import.meta.env.DEV;

const AUTO_FILL_PREFERENCE_KEY = "launchpad.devMediaAutoFill";

function readAutoFillPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTO_FILL_PREFERENCE_KEY) !== "off";
}

function toImageMap(assets: StoredImage[]): Map<string, StoredMediaImage> {
  return new Map(assets.map(asset => [asset.slot, asset]));
}

export function MediaTab({
  clientId,
  value,
  assets,
  uploadingSlot,
  onUpload,
  onSlotAssetChange,
}: {
  clientId: number;
  value: AstroClientConfigInput;
  assets: StoredImage[];
  uploadingSlot: AstroAssetSlot | null;
  onUpload: (
    slot: AstroAssetSlot,
    file: File,
    options?: UploadOptions,
  ) => Promise<AssetUploadResult>;
  onSlotAssetChange: (slot: string, asset: StoredImage | null) => void;
}) {
  const utils = trpc.useUtils();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });
  const requestUploadMutation = trpc.assets.requestUpload.useMutation();
  const completeUploadMutation = trpc.assets.completeUpload.useMutation();
  const libraryQuery = trpc.assets.listLibrary.useQuery({ clientId });
  const updateLibraryMutation = trpc.assets.updateLibraryItem.useMutation();
  const deleteLibraryMutation = trpc.assets.deleteLibraryItem.useMutation();
  const assignLibraryMutation = trpc.assets.assignLibraryItem.useMutation();
  const clearSlotMutation = trpc.assets.clearSlot.useMutation();
  const [uploadingMarketingSlot, setUploadingMarketingSlot] = useState<AssetSlot | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(readAutoFillPreference);
  const marketingUploadInFlightRef = useRef(false);

  const libraryItems = libraryQuery.data?.items ?? [];
  const slots = useMemo(
    () =>
      applyLibrarySlotImages(
        resolveMediaSlots(
          buildMediaSlotCatalog(value),
          toImageMap(assets),
          toImageMap(workspaceQuery.data?.assets ?? []),
        ),
        libraryItems,
      ),
    [assets, libraryItems, value, workspaceQuery.data],
  );

  const busySlotId = uploadingSlot
    ? astroSlotId(uploadingSlot)
    : uploadingMarketingSlot
      ? clientSlotId(uploadingMarketingSlot)
      : null;

  const uploadMarketingPhoto = async (
    slot: AssetSlot,
    file: File,
    options?: UploadOptions,
  ): Promise<AssetUploadResult> => {
    if (marketingUploadInFlightRef.current) {
      return { ok: false, message: "Another upload is already running." };
    }
    try {
      marketingUploadInFlightRef.current = true;
      setUploadingMarketingSlot(slot);
      await uploadAssetDirectly(
        file,
        { clientId, assetKind: "client", slot },
        {
          requestUpload: input => requestUploadMutation.mutateAsync({
            clientId: input.clientId,
            assetKind: "client",
            slot,
            originalFilename: input.originalFilename,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          }),
          completeUpload: input => completeUploadMutation.mutateAsync(input),
          fetchFn: (input, init) => fetch(input, init),
        },
      );
      await Promise.all([
        utils.workspace.get.invalidate({ clientId }),
        utils.clients.list.invalidate(),
      ]);
      if (!options?.quiet) toast.success("Photo added.");
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "That photo could not be uploaded.";
      if (!options?.quiet) toast.error(message);
      return { ok: false, message };
    } finally {
      marketingUploadInFlightRef.current = false;
      setUploadingMarketingSlot(null);
    }
  };

  const uploadToSlot = (
    target: ResolvedMediaSlot,
    file: File,
    options?: UploadOptions,
  ): Promise<AssetUploadResult> => {
    const rejection = imageUploadRejectionMessage(file);
    if (rejection) {
      if (!options?.quiet) toast.error(rejection);
      return Promise.resolve({ ok: false, message: rejection });
    }
    switch (target.kind) {
      case "astro":
        return onUpload(target.slot, file, options);
      case "client":
        return uploadMarketingPhoto(target.slot, file, options);
      default: {
        const exhaustive: never = target;
        throw new Error(`Unhandled media slot kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  };

  const refreshLibrary = async () => {
    await Promise.all([
      utils.assets.listLibrary.invalidate({ clientId }),
      utils.workspace.get.invalidate({ clientId }),
      utils.astroConfig.get.invalidate({ clientId }),
      utils.clients.list.invalidate(),
    ]);
  };

  const uploadLibraryPhotos = async (files: File[]) => {
    if (files.length === 0) return;
    setLibraryBusy(true);
    try {
      let uploaded = 0;
      for (const file of files) {
        const rejection = imageUploadRejectionMessage(file);
        if (rejection) {
          toast.error(rejection);
          continue;
        }
        try {
          await uploadAssetDirectly(
            file,
            { clientId, assetKind: "library", slot: LIBRARY_UPLOAD_SLOT },
            {
              requestUpload: input => requestUploadMutation.mutateAsync({
                clientId: input.clientId,
                assetKind: "library",
                slot: LIBRARY_UPLOAD_SLOT,
                originalFilename: input.originalFilename,
                mimeType: input.mimeType,
                sizeBytes: input.sizeBytes,
              }),
              completeUpload: input => completeUploadMutation.mutateAsync(input),
              fetchFn: (input, init) => fetch(input, init),
            },
          );
          uploaded += 1;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "That photo could not be uploaded.");
        }
      }
      await refreshLibrary();
      const added = photosAddedToLibraryToast(uploaded);
      if (added) toast.success(added);
    } finally {
      setLibraryBusy(false);
    }
  };

  const saveLibraryCopy = async (itemId: number, next: { alt: string; description: string }) => {
    try {
      const item = await updateLibraryMutation.mutateAsync({ clientId, itemId, ...next });
      await refreshLibrary();
      for (const slot of item.slots) {
        onSlotAssetChange(slot, {
          slot,
          storageUrl: item.storageUrl,
          filename: item.filename,
          byteSize: item.byteSize,
          mediaItemId: item.id,
          alt: item.alt,
          description: item.description,
        });
      }
      toast.success("Photo details saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo details could not be saved.");
    }
  };

  const deleteLibraryItem = async (itemId: number) => {
    try {
      const item = libraryItems.find(entry => entry.id === itemId);
      await deleteLibraryMutation.mutateAsync({ clientId, itemId });
      await refreshLibrary();
      for (const slot of item?.slots ?? []) onSlotAssetChange(slot, null);
      toast.success("Photo removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo could not be removed.");
    }
  };

  const assignLibraryItem = async (target: ResolvedMediaSlot, itemId: number) => {
    try {
      const item = await assignLibraryMutation.mutateAsync(
        target.kind === "client"
          ? { clientId, itemId, assetKind: "client", slot: target.slot }
          : { clientId, itemId, assetKind: "astro", slot: target.slot },
      );
      await refreshLibrary();
      onSlotAssetChange(target.slot, {
        slot: target.slot,
        storageUrl: item.storageUrl,
        filename: item.filename,
        byteSize: item.byteSize,
        mediaItemId: item.id,
        alt: item.alt,
        description: item.description,
      });
      toast.success("Photo placed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo could not be placed.");
    }
  };

  const clearSelectedSlot = async (target: ResolvedMediaSlot) => {
    try {
      await clearSlotMutation.mutateAsync(
        target.kind === "client"
          ? { clientId, assetKind: "client", slot: target.slot }
          : { clientId, assetKind: "astro", slot: target.slot },
      );
      await refreshLibrary();
      onSlotAssetChange(target.slot, null);
      toast.success("Photo removed from this placement.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo could not be removed.");
    }
  };

  const placeholderFill = useDevPlaceholderFill({
    enabled: PLACEHOLDER_FILL_AVAILABLE,
    autoRun: autoFillEnabled && workspaceQuery.isSuccess,
    slots,
    uploadSlot: (target, file) => uploadToSlot(target, file, { quiet: true }),
  });

  return (
    <div id="config-section-media" tabIndex={-1} className="space-y-3 focus-visible:outline-none">
      {PLACEHOLDER_FILL_AVAILABLE ? (
        <DevPlaceholderFillBar
          progress={placeholderFill.progress}
          missingCount={placeholderFill.missingCount}
          autoRunEnabled={autoFillEnabled}
          onToggleAutoRun={enabled => {
            setAutoFillEnabled(enabled);
            window.localStorage.setItem(AUTO_FILL_PREFERENCE_KEY, enabled ? "on" : "off");
          }}
          onStart={placeholderFill.start}
        />
      ) : null}

      <MediaWorkspace
        slots={slots}
        libraryItems={libraryItems}
        busySlotId={busySlotId}
        libraryBusy={libraryBusy || updateLibraryMutation.isPending || deleteLibraryMutation.isPending || assignLibraryMutation.isPending || clearSlotMutation.isPending}
        onAddFiles={files => void uploadLibraryPhotos(files)}
        onUploadToSlot={(slot, file) => void uploadToSlot(slot, file)}
        onRemoveSlot={slot => void clearSelectedSlot(slot)}
        onAssign={(slot, itemId) => void assignLibraryItem(slot, itemId)}
        onSaveCopy={(itemId, next) => void saveLibraryCopy(itemId, next)}
        onDeleteLibraryItem={itemId => void deleteLibraryItem(itemId)}
      />
    </div>
  );
}
