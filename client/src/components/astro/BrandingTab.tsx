import { ImageUploadCard } from "@/components/ImageUploadCard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ASTRO_ASSET_LABELS,
  ASTRO_ASSET_SLOT_VALUES,
  ASTRO_THEME_VALUES,
  type AstroAssetSlot,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { ImageIcon, Palette, Type } from "lucide-react";

type StoredImage = { slot: string; storageUrl: string; filename: string; byteSize: number };

const BRAND_ASSET_SLOTS: AstroAssetSlot[] = ["navLogo", "footerLogo", "inventoryLogo", "favicon", "ogImage"];
const THEME_META = {
  aqua: { label: "Aqua", description: "Bright and water focused", swatches: ["#06b6d4", "#0e7490", "#ecfeff"] },
  luxury: { label: "Luxury", description: "Dark and premium", swatches: ["#171717", "#d4af37", "#faf7ef"] },
  natural: { label: "Natural", description: "Warm and grounded", swatches: ["#365314", "#a3b18a", "#f5f2e8"] },
  mono: { label: "Mono", description: "Neutral and editorial", swatches: ["#0a0a0a", "#737373", "#fafafa"] },
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-extrabold">{label}</span>{children}</label>;
}

export function BrandingTab({
  value,
  onChange,
  assets,
  uploadingSlot,
  onUpload,
}: {
  value: AstroClientConfigInput;
  onChange: (next: AstroClientConfigInput) => void;
  assets: StoredImage[];
  uploadingSlot: AstroAssetSlot | null;
  onUpload: (slot: AstroAssetSlot, file: File) => void;
}) {
  const assetMap = new Map(assets.map(asset => [asset.slot, asset]));
  const updateBrand = (brand: AstroClientConfigInput["brand"]) => onChange({ ...value, brand });

  return <div className="space-y-5">
    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="mb-6 flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Palette className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Theme</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Choose the site’s overall visual direction.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{ASTRO_THEME_VALUES.map(theme => { const meta = THEME_META[theme]; const active = value.brand.theme === theme; return <button key={theme} type="button" onClick={() => updateBrand({ ...value.brand, theme })} className={`rounded-2xl border p-4 text-left ${active ? "border-cyan-400 bg-cyan-400/[0.08] ring-2 ring-cyan-300/15" : "border-white/9 bg-white/[0.02]"}`}><div className="flex gap-2">{meta.swatches.map(color => <span key={color} className="h-7 flex-1 rounded-lg border border-white/10" style={{ backgroundColor: color }} />)}</div><p className="mt-4 font-extrabold">{meta.label}</p><p className="mt-1 text-sm font-medium text-muted-foreground">{meta.description}</p></button>; })}</div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="mb-6 flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Type className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Fonts and corners</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Set the font families and the site’s corner rounding.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Display font"><Input value={value.brand.fonts.display} onChange={event => updateBrand({ ...value.brand, fonts: { ...value.brand.fonts, display: event.target.value } })} /></Field>
        <Field label="Body font"><Input value={value.brand.fonts.body} onChange={event => updateBrand({ ...value.brand, fonts: { ...value.brand.fonts, body: event.target.value } })} /></Field>
        <Field label="Mono font"><Input value={value.brand.fonts.mono} onChange={event => updateBrand({ ...value.brand, fonts: { ...value.brand.fonts, mono: event.target.value } })} /></Field>
        <Field label="Google Fonts URL"><Input value={value.brand.fonts.googleFontsUrl} onChange={event => updateBrand({ ...value.brand, fonts: { ...value.brand.fonts, googleFontsUrl: event.target.value } })} /></Field>
        {(["card", "button", "pill"] as const).map(key => <Field key={key} label={`${key[0].toUpperCase() + key.slice(1)} radius (px)`}><Input type="number" min={0} max={999} value={value.brand.borderRadii[key]} onChange={event => updateBrand({ ...value.brand, borderRadii: { ...value.brand.borderRadii, [key]: Number(event.target.value) } })} /></Field>)}
      </div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="mb-6 flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><ImageIcon className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Brand images</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Upload the exact images the Astro template expects.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{BRAND_ASSET_SLOTS.map(slot => <ImageUploadCard key={slot} label={ASTRO_ASSET_LABELS[slot]} guidance={slot === "ogImage" ? "Wide image used when the site is shared." : slot === "favicon" ? "Square brand icon shown in browser tabs." : "Use a clear transparent or simple-background logo."} image={assetMap.get(slot)} busy={uploadingSlot === slot} onFile={file => onUpload(slot, file)} />)}</div>
    </Card>
  </div>;
}
