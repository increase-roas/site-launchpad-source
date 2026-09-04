import { Button } from "@/components/ui/button";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import {
  parseGalleryImages,
  serializeGalleryImages,
  type GalleryImage,
} from "@shared/mediaLibrary";
import { Plus, Trash2 } from "lucide-react";
import { MediaCopyFields } from "./MediaCopyFields";

export function GalleryImagesField({
  value,
  libraryItems,
  onChange,
}: {
  value: string;
  libraryItems: MediaLibraryItemView[];
  onChange: (next: string) => void;
}) {
  const images = parseGalleryImages(value);
  const usedIds = new Set(images.map(image => image.id).filter((id): id is number => id != null));
  const available = libraryItems.filter(item => !usedIds.has(item.id));

  const write = (next: GalleryImage[]) => onChange(serializeGalleryImages(next));

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add photos from the library. Each one can have its own alt text.</p>
      ) : (
        <ul className="space-y-3">
          {images.map((image, index) => (
            <li key={`${image.id ?? image.src}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex gap-3">
                <img
                  src={image.src}
                  alt={image.alt || "Gallery photo"}
                  className="h-20 w-28 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <MediaCopyFields
                    alt={image.alt}
                    description={image.description}
                    onSave={next => write(images.map((entry, entryIndex) => (
                      entryIndex === index ? { ...entry, ...next } : entry
                    )))}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove gallery photo"
                  onClick={() => write(images.filter((_, entryIndex) => entryIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold">Add from library</p>
          <div className="flex flex-wrap gap-2">
            {available.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => write([
                  ...images,
                  {
                    id: item.id,
                    src: item.storageUrl,
                    alt: item.alt,
                    description: item.description,
                  },
                ])}
                className="overflow-hidden rounded-md border border-border"
                title={item.alt || item.filename}
              >
                <img src={item.storageUrl} alt={item.alt || item.filename} className="h-14 w-20 object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Upload photos under Media, then add them here.
        </p>
      )}
    </div>
  );
}
