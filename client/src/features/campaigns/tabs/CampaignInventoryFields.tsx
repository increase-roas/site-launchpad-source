import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SIMPLE_FORM_TEMPLATE_PRODUCTS,
  type SimpleFormImageSource,
  type SimpleFormOperatorConfig,
  type SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import {
  Field,
  ImageSourcePicker,
  Section,
  ToggleRow,
  type CampaignAsset,
} from "../campaignFields";
import { reorderSimpleFormProducts } from "../publishControl";

type Product = SimpleFormOperatorConfig["inventory"]["products"][number];

/** Cards a visitor never sees need nothing, so only live ones are chased. */
function cardSummary(product: Product): { label: string; tone: "warning" | null } {
  if (!product.active) return { label: "Hidden", tone: null };
  if (!product.ctaUrl.trim()) return { label: "Needs a link", tone: "warning" };
  return { label: product.priceLabel?.trim() || "Shown", tone: null };
}

function InventoryCard({
  index,
  product,
  record,
  assets,
  first,
  last,
  onPatch,
  onMove,
  onImageChange,
}: {
  index: number;
  product: Product;
  record: SimpleFormStoredRecord;
  assets: CampaignAsset[];
  first: boolean;
  last: boolean;
  onPatch: (partial: Partial<Product>) => void;
  onMove: (to: number) => void;
  onImageChange: (source: SimpleFormImageSource) => void;
}) {
  const summary = cardSummary(product);

  return (
    <Collapsible className="rounded-lg border border-border">
      <div className="flex items-center gap-1 pr-2">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-muted/40">
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {index + 1}. {product.name.trim() || "Untitled card"}
          </span>
          {summary.tone ? (
            <StatusBadge tone="warning" label={summary.label} />
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">{summary.label}</span>
          )}
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={first}
          aria-label={`Move ${product.name} up`}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={last}
          aria-label={`Move ${product.name} down`}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t border-border p-3">
          <ToggleRow
            label="Show this card"
            checked={product.active}
            onCheckedChange={active => onPatch({ active })}
          />
          <Field label="Name">
            <Input
              value={product.name}
              onChange={event => onPatch({ name: event.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={product.description ?? ""}
              onChange={event => onPatch({ description: event.target.value })}
              className="min-h-16"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Price label">
              <Input
                value={product.priceLabel ?? ""}
                onChange={event => onPatch({ priceLabel: event.target.value })}
              />
            </Field>
            <Field label="Button label">
              <Input
                value={product.ctaLabel}
                onChange={event => onPatch({ ctaLabel: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Button link" hint="https://… or tel:+1…">
            <Input
              value={product.ctaUrl}
              onChange={event => onPatch({ ctaUrl: event.target.value })}
            />
          </Field>
          <ImageSourcePicker
            label="Image"
            source={record.imageSources.products[index] ?? { mode: "template" }}
            previewUrl={SIMPLE_FORM_TEMPLATE_PRODUCTS[index]?.imageUrl ?? product.imageUrl}
            assets={assets}
            onChange={onImageChange}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CampaignInventoryFields({
  record,
  assets,
  onChange,
}: {
  record: SimpleFormStoredRecord;
  assets: CampaignAsset[];
  onChange: (record: SimpleFormStoredRecord) => void;
}) {
  const config = record.config;
  const inventory = config.inventory;
  const patchInventory = (partial: Partial<SimpleFormOperatorConfig["inventory"]>) =>
    onChange({ ...record, config: { ...config, inventory: { ...inventory, ...partial } } });

  const patchProduct = (index: number, partial: Partial<Product>) =>
    patchInventory({
      products: inventory.products.map((product, productIndex) =>
        productIndex === index ? { ...product, ...partial } : product,
      ),
    });

  // Order is published order, so the images have to travel with the cards.
  const moveProduct = (from: number, to: number) => {
    if (to < 0 || to >= inventory.products.length) return;
    onChange({
      ...record,
      config: {
        ...config,
        inventory: {
          ...inventory,
          products: reorderSimpleFormProducts(inventory.products, from, to),
        },
      },
      imageSources: {
        ...record.imageSources,
        products: reorderSimpleFormProducts(record.imageSources.products, from, to),
      },
    });
  };

  const shown = inventory.products.filter(product => product.active).length;

  return (
    <Section
      title="Inventory cards"
      description="An optional strip of products under the thank-you message."
    >
      <ToggleRow
        label="Show inventory on the thank-you page"
        hint={
          inventory.enabled
            ? `${shown} of ${inventory.products.length} cards shown, in this order.`
            : "The thank-you page ends with your message."
        }
        checked={inventory.enabled}
        onCheckedChange={enabled => patchInventory({ enabled })}
      />

      {inventory.enabled ? (
        <>
          <Field label="Headline">
            <Input
              value={inventory.headline}
              onChange={event => patchInventory({ headline: event.target.value })}
            />
          </Field>
          <Field label="Subheadline">
            <Textarea
              value={inventory.subheadline}
              onChange={event => patchInventory({ subheadline: event.target.value })}
              className="min-h-16"
            />
          </Field>
          <div className="space-y-2">
            {inventory.products.map((product, index) => (
              <InventoryCard
                key={product.id}
                index={index}
                product={product}
                record={record}
                assets={assets}
                first={index === 0}
                last={index === inventory.products.length - 1}
                onPatch={partial => patchProduct(index, partial)}
                onMove={to => moveProduct(index, to)}
                onImageChange={source =>
                  onChange({
                    ...record,
                    imageSources: {
                      ...record.imageSources,
                      products: record.imageSources.products.map((item, itemIndex) =>
                        itemIndex === index ? source : item,
                      ),
                    },
                  })
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </Section>
  );
}
