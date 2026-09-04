import { Switch } from "@/components/ui/switch";
import type { AstroCategory, AstroClientConfigInput } from "@shared/astroConfig";
import type { ConfigReadiness } from "@shared/astroConfigReadiness";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import { BadgeDollarSign, LayoutList, Menu, ShoppingBag } from "lucide-react";
import { ConfigSection, SectionBody } from "./ConfigSection";
import { CategoriesEditor } from "./content/CategoriesEditor";
import { ContentJumpNav } from "./content/ContentJumpNav";
import { FinancingEditor } from "./content/FinancingEditor";
import { HomepageSectionsEditor } from "./content/HomepageSectionsEditor";
import { NavigationEditor } from "./content/NavigationEditor";

type StoredImage = { slot: string; storageUrl: string; filename: string; byteSize: number };

export function ContentTab({
  value,
  readiness,
  onChange,
  assets,
  mediaItems,
}: {
  value: AstroClientConfigInput;
  readiness: ConfigReadiness;
  onChange: (next: AstroClientConfigInput) => void;
  assets: StoredImage[];
  mediaItems?: MediaLibraryItemView[];
}) {
  const enabledCategories = Object.values(value.categories).filter(category => category.enabled).length;
  const enabledSections = value.homepageSections.filter(section => section.enabled).length;

  const updateCategory = (
    category: AstroCategory,
    patch: Partial<AstroClientConfigInput["categories"][AstroCategory]>,
  ) =>
    onChange({
      ...value,
      categories: { ...value.categories, [category]: { ...value.categories[category], ...patch } },
    });

  return (
    <div className="space-y-3">
      <ContentJumpNav readiness={readiness} />

      <ConfigSection
        icon={Menu}
        title="Navigation"
        description="The links that appear in the header and footer, in the order customers see them."
        readiness={readiness.sections.navigation}
      >
        <SectionBody>
          <NavigationEditor
            items={value.navigationItems}
            onChange={navigationItems => onChange({ ...value, navigationItems })}
          />
        </SectionBody>
      </ConfigSection>

      <ConfigSection
        icon={ShoppingBag}
        title="Categories"
        description="Enable only the product groups this client sells, then complete the visible details."
        readiness={readiness.sections.categories}
        toolbar={
          <span className="text-xs tabular-nums text-muted-foreground">
            {enabledCategories} of {Object.keys(value.categories).length} groups on
          </span>
        }
      >
        <SectionBody>
          <CategoriesEditor
            value={value.categories}
            readiness={readiness}
            assets={assets}
            onChange={updateCategory}
          />
        </SectionBody>
      </ConfigSection>

      <ConfigSection
        icon={BadgeDollarSign}
        title="Financing"
        description="Turn financing on only when the client has approved lender details and copy."
        readiness={readiness.sections.financing}
        toolbar={
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={value.financing.enabled}
              onCheckedChange={enabled => onChange({ ...value, financing: { ...value.financing, enabled } })}
            />
            {value.financing.enabled ? "Financing is on" : "Financing is off"}
          </label>
        }
      >
        <SectionBody>
          <FinancingEditor
            value={value.financing}
            readiness={readiness}
            onChange={financing => onChange({ ...value, financing })}
          />
        </SectionBody>
      </ConfigSection>

      <ConfigSection
        icon={LayoutList}
        title="Homepage sections"
        description="Add the sections the template supports, put them in order, and fill each type’s fields."
        readiness={readiness.sections.homepage}
        toolbar={
          <span className="text-xs tabular-nums text-muted-foreground">
            {enabledSections} of {value.homepageSections.length} sections enabled
          </span>
        }
      >
        <SectionBody className="p-3 sm:p-4">
          <HomepageSectionsEditor
            sections={value.homepageSections}
            readiness={readiness}
            mediaItems={mediaItems}
            onChange={homepageSections => onChange({ ...value, homepageSections })}
          />
        </SectionBody>
      </ConfigSection>
    </div>
  );
}
