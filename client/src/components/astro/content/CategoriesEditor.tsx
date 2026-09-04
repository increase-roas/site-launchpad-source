import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ASTRO_CATEGORY_VALUES,
  type AstroCategory,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { fieldMessageFor, fieldStateFor, type ConfigReadiness } from "@shared/astroConfigReadiness";
import { ImageIcon, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { FieldCell, FieldGrid } from "../ConfigSection";
import { CATEGORY_ASSET_SLOT, CATEGORY_LABELS } from "../categories";

type StoredImage = { slot: string };

export function CategoriesEditor({
  value,
  readiness,
  assets,
  onChange,
}: {
  value: AstroClientConfigInput["categories"];
  readiness: ConfigReadiness;
  assets: StoredImage[];
  onChange: (category: AstroCategory, patch: Partial<AstroClientConfigInput["categories"][AstroCategory]>) => void;
}) {
  const enabledCount = ASTRO_CATEGORY_VALUES.filter(category => value[category].enabled).length;
  const firstEnabled = ASTRO_CATEGORY_VALUES.find(category => value[category].enabled);
  const [selected, setSelected] = useState<AstroCategory>(firstEnabled ?? "hot-tubs");
  const config = value[selected];
  const assetMap = new Set(assets.map(asset => asset.slot));
  const hasHero = assetMap.has(CATEGORY_ASSET_SLOT[selected]);
  const cell = (field: "label" | "slug" | "description" | "heroImage", optional = false) => ({
    state: fieldStateFor(readiness, `categories.${selected}.${field}`, { optional }),
    message: fieldMessageFor(readiness, `categories.${selected}.${field}`),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ItemGroup className="gap-2">
        {ASTRO_CATEGORY_VALUES.map(category => {
          const item = value[category];
          const active = selected === category;
          return (
            <Item
              key={category}
              variant={active ? "muted" : "outline"}
              size="sm"
              role="button"
              tabIndex={0}
              aria-current={active ? "true" : undefined}
              onClick={() => setSelected(category)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(category);
                }
              }}
              className="cursor-pointer"
            >
              <ItemMedia variant="icon">
                <ShoppingBag />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{CATEGORY_LABELS[category]}</ItemTitle>
                <ItemDescription>{item.enabled ? item.label || "On the website" : "Hidden"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={item.enabled ? "default" : "outline"}>{item.enabled ? "On" : "Off"}</Badge>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>

      <Card className="gap-0 py-0 shadow-none">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm">{CATEGORY_LABELS[selected]}</CardTitle>
          <CardDescription>
            {enabledCount === 0
              ? "Turn on at least one product group before launch."
              : `${enabledCount} ${enabledCount === 1 ? "group" : "groups"} visible on the site.`}
          </CardDescription>
          <CardAction>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={config.enabled}
                onCheckedChange={enabled => onChange(selected, { enabled })}
              />
              {config.enabled ? "Visible" : "Hidden"}
            </label>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {config.enabled ? (
            <>
              <FieldGrid columns={2}>
                <FieldCell label="Label" {...cell("label")}>
                  <Input
                    value={config.label}
                    onChange={event => onChange(selected, { label: event.target.value })}
                  />
                </FieldCell>
                <FieldCell label="URL slug" {...cell("slug")} hint="Used in category page addresses.">
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>/</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      value={config.slug}
                      onChange={event => onChange(selected, { slug: event.target.value.replace(/^\/+/, "") })}
                    />
                  </InputGroup>
                </FieldCell>
                <FieldCell label="Description" span={2} {...cell("description")}>
                  <Textarea
                    value={config.description}
                    onChange={event => onChange(selected, { description: event.target.value })}
                    className="min-h-28"
                  />
                </FieldCell>
              </FieldGrid>
              <div className="p-4">
                <Alert variant={hasHero ? "default" : "destructive"}>
                  <ImageIcon />
                  <AlertTitle>{hasHero ? "Hero photo is ready" : "Hero photo still needed"}</AlertTitle>
                  <AlertDescription>
                    {hasHero
                      ? "The category image is set in Media."
                      : "Add this category’s hero photo in the Media tab before publish."}
                  </AlertDescription>
                </Alert>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              This group is hidden. Turn it on to edit the label, slug, and description customers see.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
