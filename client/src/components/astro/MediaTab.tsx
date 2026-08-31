import { Button } from "@/components/ui/button";
import { uploadAssetDirectly, type AssetUploadResult } from "@/lib/assetUpload";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  isSupportedImageMimeType,
  MAX_RAW_UPLOAD_BYTES,
} from "@shared/assetUpload";
import type { AstroAssetSlot, AstroClientConfigInput } from "@shared/astroConfig";
import type { AssetSlot } from "@shared/client";
import { LayoutGrid, Rows3, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DevPlaceholderFillBar } from "./media/DevPlaceholderFillBar";
import { MediaSlotDetail } from "./media/MediaSlotDetail";
import { MediaSlotGrid } from "./media/MediaSlotGrid";
import { MediaSlotRail } from "./media/MediaSlotRail";
import {
  astroSlotId,
  buildMediaSlotCatalog,
  clientSlotId,
  nextMissingSlotId,
  resolveMediaSlots,
  type ResolvedMediaSlot,
  type StoredMediaImage,
} from "./media/mediaSlots";
import { useDevPlaceholderFill } from "./media/useDevPlaceholderFill";

type StoredImage = StoredMediaImage & { slot: string };

type MediaView = "detail" | "grid";

/** Bulk fills report their own progress, so per-upload toasts are suppressed. */
type UploadOptions = { quiet?: boolean };

/** Generated stand-in artwork is a development affordance and never ships. */
const PLACEHOLDER_FILL_AVAILABLE = import.meta.env.DEV;

const AUTO_FILL_PREFERENCE_KEY = "launchpad.devMediaAutoFill";

function readAutoFillPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTO_FILL_PREFERENCE_KEY) !== "off";
}

const MEDIA_VIEWS: ReadonlyArray<{ id: MediaView; label: string; icon: LucideIcon }> = [
  { id: "detail", label: "List", icon: Rows3 },
  { id: "grid", label: "Thumbnails", icon: LayoutGrid },
];

function toImageMap(assets: StoredImage[]): Map<string, StoredMediaImage> {
  return new Map(assets.map(asset => [asset.slot, asset]));
}

export function MediaTab({
  clientId,
  value,
  assets,
  uploadingSlot,
  onUpload,
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
}) {
  const utils = trpc.useUtils();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });
  const requestUploadMutation = trpc.assets.requestUpload.useMutation();
  const completeUploadMutation = trpc.assets.completeUpload.useMutation();
  const [uploadingMarketingSlot, setUploadingMarketingSlot] = useState<AssetSlot | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => astroSlotId("navLogo"));
  const [view, setView] = useState<MediaView>("detail");
  const [autoFillEnabled, setAutoFillEnabled] = useState(readAutoFillPreference);
  const marketingUploadInFlightRef = useRef(false);

  const slots = useMemo(
    () =>
      resolveMediaSlots(
        buildMediaSlotCatalog(value),
        toImageMap(assets),
        toImageMap(workspaceQuery.data?.assets ?? []),
      ),
    [assets, value, workspaceQuery.data],
  );

  const selected = slots.find(slot => slot.id === selectedId) ?? slots[0];
  const nextMissingId = nextMissingSlotId(slots, selected.id);
  const nextMissingLabel = slots.find(slot => slot.id === nextMissingId)?.label ?? null;

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

  /** Each slot belongs to exactly one asset system and they never share an upload path. */
  const uploadToSlot = (
    target: ResolvedMediaSlot,
    file: File,
    options?: UploadOptions,
  ): Promise<AssetUploadResult> => {
    if (!isSupportedImageMimeType(file.type) || file.size <= 0 || file.size > MAX_RAW_UPLOAD_BYTES) {
      const message = "Choose an image file smaller than 20 MB.";
      if (!options?.quiet) toast.error(message);
      return Promise.resolve({ ok: false, message });
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

      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {slots.filter(slot => slot.added).length} of {slots.length} images added
        </p>
        <MediaViewToggle value={view} onChange={setView} className="ml-auto" />
      </div>

      {view === "grid" ? (
        <MediaSlotGrid
          slots={slots}
          selectedId={selected.id}
          busySlotId={busySlotId}
          onSelect={slotId => {
            setSelectedId(slotId);
            setView("detail");
          }}
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(210px,250px)_1fr]">
          <MediaSlotRail
            slots={slots}
            selectedId={selected.id}
            busySlotId={busySlotId}
            onSelect={setSelectedId}
            className="max-h-[18rem] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"
          />
          <MediaSlotDetail
            slot={selected}
            busy={busySlotId === selected.id}
            nextMissingLabel={nextMissingLabel}
            onFile={file => uploadToSlot(selected, file)}
            onNextMissing={() => {
              if (nextMissingId) setSelectedId(nextMissingId);
            }}
            className="lg:sticky lg:top-4"
          />
        </div>
      )}
    </div>
  );
}

function MediaViewToggle({
  value,
  onChange,
  className,
}: {
  value: MediaView;
  onChange: (view: MediaView) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Image view"
      className={cn("inline-flex rounded-lg border border-border bg-muted p-0.5", className)}
    >
      {MEDIA_VIEWS.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs font-semibold",
            value === id
              ? "bg-card text-foreground shadow-sm hover:bg-card"
              : "text-muted-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
}
