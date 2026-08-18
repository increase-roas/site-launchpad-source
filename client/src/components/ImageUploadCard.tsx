import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  MEDIA_SPECIFICATIONS,
  validateImageMetadata,
  type MediaSpecification,
} from "@shared/mediaSpecifications";
import { StatusDot } from "./StatusDot";

type StoredImage = {
  storageUrl: string;
  filename: string;
  byteSize: number;
};

type ImageUploadCardProps = {
  label: string;
  guidance: string;
  image?: StoredImage;
  busy: boolean;
  onFile: (file: File) => void;
  specification?: MediaSpecification;
};

export function ImageUploadCard({
  label,
  guidance,
  image,
  busy,
  onFile,
  specification = MEDIA_SPECIFICATIONS.landscape,
}: ImageUploadCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const acceptFile = async (file?: File) => {
    if (!file || busy) return;
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The image could not be read."));
      };
      image.src = url;
    }).catch(() => null);
    if (!dimensions) {
      setValidationError("Choose a valid image file.");
      return;
    }
    const error = validateImageMetadata({
      mimeType: file.type,
      sizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
    }, specification);
    setValidationError(error);
    if (error) return;
    onFile(file);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/[0.02] transition-colors",
        dragging ? "border-cyan-400 bg-cyan-400/6" : "border-white/9",
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
      {image ? (
        <div className="relative aspect-[16/10] bg-black/25">
          <img
            src={image.storageUrl}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
            <StatusDot good label="Added" compact />
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 p-5 text-center disabled:cursor-not-allowed"
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-base font-extrabold text-foreground">
              {busy ? "Preparing photo…" : "Drop photo here"}
            </p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {busy ? "This usually takes a moment." : "or tap to choose one"}
            </p>
          </div>
          {!busy ? <StatusDot good={false} label="Missing" compact /> : null}
        </button>
      )}

      <div className="border-t border-white/8 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-foreground">{label}</h3>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
              {guidance}
            </p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
              {specification.label}
            </p>
            {validationError ? (
              <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{validationError}</p>
            ) : null}
          </div>
          {image ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="h-10 shrink-0 border-white/10 bg-white/[0.025] font-bold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Replace
            </Button>
          ) : null}
        </div>
        {image ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            {image.filename} · {Math.max(1, Math.round(image.byteSize / 1024))} KB
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={specification.mimeTypes.join(",")}
        className="sr-only"
        disabled={busy}
        onChange={event => {
          void acceptFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
