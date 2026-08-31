import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImageMetadata } from "@shared/mediaSpecifications";
import { ArrowRight, Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MEDIA_GROUP_DESCRIPTIONS, type ResolvedMediaSlot } from "./mediaSlots";

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const probe = new Image();
    const url = URL.createObjectURL(file);
    probe.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be read."));
    };
    probe.src = url;
  }).catch(() => null);
}

export function MediaSlotDetail({
  slot,
  busy,
  nextMissingLabel,
  onFile,
  onNextMissing,
  className,
}: {
  slot: ResolvedMediaSlot;
  busy: boolean;
  nextMissingLabel: string | null;
  onFile: (file: File) => void;
  onNextMissing: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);
    setDragging(false);
  }, [slot.id]);

  const acceptFile = async (file?: File) => {
    if (!file || busy) return;
    const dimensions = await readImageDimensions(file);
    if (!dimensions) {
      setValidationError("Choose a valid image file.");
      return;
    }
    const error = validateImageMetadata(
      {
        mimeType: file.type,
        sizeBytes: file.size,
        width: dimensions.width,
        height: dimensions.height,
      },
      slot.specification,
    );
    setValidationError(error);
    if (error) return;
    onFile(file);
  };

  return (
    <section className={cn("launchpad-panel flex flex-col overflow-hidden rounded-lg", className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold leading-tight">{slot.label}</h2>
            {slot.required ? (
              <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                Required to publish
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{slot.guidance}</p>
        </div>
        {nextMissingLabel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNextMissing}
            className="ml-auto h-8 shrink-0 gap-1.5 text-xs font-semibold"
          >
            Next missing
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      <div
        className={cn(
          "relative m-4 overflow-hidden rounded-lg border transition-colors",
          dragging ? "border-primary bg-primary/[0.06]" : "border-border bg-muted",
        )}
        onDragEnter={event => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          void acceptFile(event.dataTransfer.files[0]);
        }}
      >
        {slot.image ? (
          <div className="relative aspect-[16/9] max-h-[46vh] bg-muted">
            <img
              src={slot.image.storageUrl}
              alt={`${slot.label} preview`}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[16/9] max-h-[46vh] w-full flex-col items-center justify-center gap-3 p-6 text-center disabled:cursor-not-allowed"
          >
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-card text-muted-foreground">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {busy ? "Preparing photo…" : "Drop photo here"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {busy ? "This usually takes a moment." : "or click to choose one"}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3 px-4 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-muted-foreground">{slot.specification.label}</p>
          {slot.image ? (
            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {slot.image.filename} · {Math.max(1, Math.round(slot.image.byteSize / 1024))} KB
            </p>
          ) : null}
          {validationError ? (
            <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
              {validationError}
            </p>
          ) : null}
        </div>
        {slot.image ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Replace
          </Button>
        ) : null}
      </div>

      <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {MEDIA_GROUP_DESCRIPTIONS[slot.group]}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={slot.specification.mimeTypes.join(",")}
        className="sr-only"
        disabled={busy}
        onChange={event => {
          void acceptFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
