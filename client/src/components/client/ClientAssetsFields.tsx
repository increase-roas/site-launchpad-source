import { PHOTO_GUIDANCE } from "@/components/client/clientEditorForm";
import { SectionHeading } from "@/components/client/ClientEditorFields";
import { ImageUploadCard } from "@/components/ImageUploadCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASSET_SLOT_LABELS, MARKETING_ASSET_SLOT_VALUES, type AssetSlot } from "@shared/client";
import { ImageIcon, Loader2, Save } from "lucide-react";
import { MEDIA_SPECIFICATIONS } from "@shared/mediaSpecifications";

type ClientAssetPreview = { storageUrl: string; filename: string; byteSize: number };

export function ClientAssetsFields({
  clientId,
  assetMap,
  uploadingSlot,
  saving,
  onFile,
}: {
  clientId: number | undefined;
  assetMap: {
    get: (slot: AssetSlot) => ClientAssetPreview | undefined;
    has: (slot: AssetSlot) => boolean;
  };
  uploadingSlot: AssetSlot | null;
  saving: boolean;
  onFile: (slot: AssetSlot, file: File) => void;
}) {
  return (
    <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
      <SectionHeading
        icon={ImageIcon}
        eyebrow="Step 6"
        title="Logo and marketing photos"
        description="Drop a photo into each box. The app prepares and names every photo automatically."
      />
      {clientId ? (
        <div className="space-y-7">
          <div>
            <h3 className="mb-3 text-lg font-extrabold">Logo</h3>
            <div className="max-w-md">
              <ImageUploadCard
                label="Business logo"
                guidance={PHOTO_GUIDANCE.logo}
                image={assetMap.get("logo")}
                busy={uploadingSlot === "logo"}
                specification={MEDIA_SPECIFICATIONS.logo}
                onFile={file => onFile("logo", file)}
              />
            </div>
          </div>
          <div className="h-px bg-white/8" />
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold">Marketing photos</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Add all six photos before launch.</p>
              </div>
              <p className="text-sm font-extrabold text-cyan-300">
                {MARKETING_ASSET_SLOT_VALUES.filter(slot => assetMap.has(slot)).length} of 6 added
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MARKETING_ASSET_SLOT_VALUES.map(slot => (
                <ImageUploadCard
                  key={slot}
                  label={ASSET_SLOT_LABELS[slot]}
                  guidance={PHOTO_GUIDANCE[slot]}
                  image={assetMap.get(slot)}
                  busy={uploadingSlot === slot}
                  specification={slot === "hero" ? MEDIA_SPECIFICATIONS.hero : MEDIA_SPECIFICATIONS.landscape}
                  onFile={file => onFile(slot, file)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-400/[0.04] px-5 py-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <ImageIcon className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-xl font-extrabold">Save the client first</h3>
          <p className="mx-auto mt-2 max-w-lg font-medium leading-relaxed text-muted-foreground">
            After saving, this page will open again with simple boxes for the logo and six photos.
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="mt-5 h-13 rounded-2xl bg-cyan-400 px-6 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save and add photos
          </Button>
        </div>
      )}
    </Card>
  );
}
