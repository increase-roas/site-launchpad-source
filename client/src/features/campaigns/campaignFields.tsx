import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { SimpleFormImageSource } from "@shared/simpleFormConfig";
import type { ReactNode } from "react";

export type CampaignAsset = {
  slot: string;
  storageUrl: string;
  filename: string;
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs leading-relaxed text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="launchpad-panel rounded-lg p-4">
      <h2 className="text-sm font-semibold leading-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** One switch and the sentence that explains what it changes. */
export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </label>
  );
}

export function ImageSourcePicker({
  label,
  source,
  previewUrl,
  assets,
  onChange,
}: {
  label: string;
  source: SimpleFormImageSource;
  previewUrl: string;
  assets: CampaignAsset[];
  onChange: (source: SimpleFormImageSource) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{label}</p>
      <RadioGroup
        value={source.mode}
        onValueChange={value => {
          if (value === "template") onChange({ mode: "template" });
          else
            onChange({
              mode: "client-media",
              slot: source.mode === "client-media" ? source.slot : (assets[0]?.slot ?? "logo"),
            });
        }}
        className="gap-2"
      >
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="template" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Template default</p>
            <img src={previewUrl} alt="" className="mt-2 max-h-24 rounded-md object-cover" />
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="client-media" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-semibold">Client media</p>
            {assets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a photo under Configuration → Media first.
              </p>
            ) : (
              <select
                aria-label={`${label} client media slot`}
                className="h-9 w-full rounded-md border border-border bg-muted px-2 text-xs"
                value={source.mode === "client-media" ? source.slot : assets[0]?.slot}
                onChange={event => onChange({ mode: "client-media", slot: event.target.value })}
              >
                {assets.map(asset => (
                  <option key={asset.slot} value={asset.slot}>
                    {asset.slot} · {asset.filename}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}
