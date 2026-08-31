import { cn } from "@/lib/utils";
import {
  ASTRO_THEME_VALUES,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import {
  fieldMessageFor,
  fieldStateFor,
  type ConfigReadiness,
} from "@shared/astroConfigReadiness";
import { syncFontStylesheetHref } from "@shared/astroFontCatalog";
import { Check, Palette, Type } from "lucide-react";
import { ConfigSection, FieldCell, FieldGrid } from "./ConfigSection";
import { FontPairingGrid } from "./FontPairingGrid";
import { FontPicker } from "./FontPicker";
import { FontSpecimen } from "./FontSpecimen";
import { UrlInput } from "./fieldWidgets";

const THEME_META = {
  aqua: { label: "Aqua", description: "Bright and water focused", swatches: ["#06b6d4", "#0e7490", "#ecfeff"] },
  luxury: { label: "Luxury", description: "Dark and premium", swatches: ["#171717", "#d4af37", "#faf7ef"] },
  natural: { label: "Natural", description: "Warm and grounded", swatches: ["#365314", "#a3b18a", "#f5f2e8"] },
  mono: { label: "Mono", description: "Neutral and editorial", swatches: ["#0a0a0a", "#737373", "#fafafa"] },
} as const;

export function BrandingTab({
  value,
  readiness,
  onChange,
}: {
  value: AstroClientConfigInput;
  readiness: ConfigReadiness;
  onChange: (next: AstroClientConfigInput) => void;
}) {
  const updateBrand = (brand: AstroClientConfigInput["brand"]) => onChange({ ...value, brand });
  const updateFonts = (fonts: AstroClientConfigInput["brand"]["fonts"]) =>
    updateBrand({ ...value.brand, fonts });

  /** Family changes keep the generated stylesheet in step; URL edits must not. */
  const updateFamilies = (fonts: AstroClientConfigInput["brand"]["fonts"]) =>
    updateFonts(syncFontStylesheetHref(fonts));

  const cell = (path: string, optional = false) => ({
    state: fieldStateFor(readiness, path, { optional }),
    message: fieldMessageFor(readiness, path),
  });

  return (
    <div className="space-y-3">
      <ConfigSection
        icon={Palette}
        title="Theme"
        description="The site's overall visual direction."
        readiness={readiness.sections.theme}
      >
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {ASTRO_THEME_VALUES.map(theme => {
            const meta = THEME_META[theme];
            const active = value.brand.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                aria-pressed={active}
                onClick={() => updateBrand({ ...value.brand, theme })}
                className={cn(
                  "relative p-3 text-left transition-colors",
                  active
                    ? "bg-primary/[0.07] shadow-[inset_0_0_0_2px_var(--primary)]"
                    : "bg-card hover:bg-muted",
                )}
              >
                {active ? (
                  <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                ) : null}
                <span className="flex gap-1.5">
                  {meta.swatches.map(color => (
                    <span
                      key={color}
                      className="h-7 flex-1 rounded-md border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span
                  className={cn(
                    "mt-2.5 block text-sm font-semibold",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {meta.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </ConfigSection>

      <ConfigSection
        icon={Type}
        title="Fonts"
        description="Start from a curated pairing, then fine-tune either family. Every choice previews in its own typeface."
        readiness={readiness.sections.fonts}
        advancedLabel="Advanced — mono font and Google Fonts URL"
        advancedSummary={value.brand.fonts.googleFontsUrl ? "set" : "empty"}
        advanced={
          <FieldGrid columns={2}>
            <FieldCell label="Mono font" {...cell("brand.fonts.mono")}>
              <FontPicker
                role="mono"
                label="Mono font"
                value={value.brand.fonts.mono}
                onChange={mono => updateFamilies({ ...value.brand.fonts, mono })}
              />
            </FieldCell>
            <FieldCell
              label="Google Fonts URL"
              {...cell("brand.fonts.googleFontsUrl", !value.brand.fonts.googleFontsUrl)}
              hint="Regenerated from the selected families unless you point it somewhere else."
            >
              <UrlInput
                value={value.brand.fonts.googleFontsUrl}
                invalid={cell("brand.fonts.googleFontsUrl").state === "invalid"}
                onChange={googleFontsUrl => updateFonts({ ...value.brand.fonts, googleFontsUrl })}
                placeholder="fonts.googleapis.com/css2?family=..."
              />
            </FieldCell>
          </FieldGrid>
        }
      >
        <FontPairingGrid
          display={value.brand.fonts.display}
          body={value.brand.fonts.body}
          onSelect={pairing =>
            updateFamilies({
              ...value.brand.fonts,
              display: pairing.display,
              body: pairing.body,
            })
          }
        />

        <div className="border-t border-border">
          <FontSpecimen
            display={value.brand.fonts.display}
            body={value.brand.fonts.body}
            headline={value.identity.businessName}
            tagline={value.identity.tagline}
          />
        </div>

        <div className="border-t border-border">
          <FieldGrid columns={2}>
            <FieldCell label="Display font" {...cell("brand.fonts.display")}>
              <FontPicker
                role="text"
                label="Display font"
                value={value.brand.fonts.display}
                onChange={display => updateFamilies({ ...value.brand.fonts, display })}
              />
            </FieldCell>
            <FieldCell label="Body font" {...cell("brand.fonts.body")}>
              <FontPicker
                role="text"
                label="Body font"
                value={value.brand.fonts.body}
                onChange={body => updateFamilies({ ...value.brand.fonts, body })}
              />
            </FieldCell>
          </FieldGrid>
        </div>
      </ConfigSection>

    </div>
  );
}
