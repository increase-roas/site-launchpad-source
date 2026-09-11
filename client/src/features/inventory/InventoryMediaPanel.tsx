import { Button } from "@/components/ui/button";
import { workspaceRoute } from "@/lib/workspaceNavigation";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Loader2, Package } from "lucide-react";
import { Link } from "wouter";
import { InventoryPhoto } from "./InventoryPhoto";

export function InventoryMediaPanel({ clientId }: { clientId: number }) {
  const workspaceQuery = trpc.inventory.workspace.useQuery({ clientId });
  const workspace = workspaceQuery.data;
  const selectedKind =
    workspace?.targets.find(target => target.kind === workspace.environment)?.kind ??
    workspace?.targets[0]?.kind;
  const listQuery = trpc.inventory.list.useQuery(
    { clientId, environment: selectedKind },
    { enabled: Boolean(selectedKind) && !workspace?.blockedBy },
  );
  const products = listQuery.data?.products ?? [];
  const photos = products.flatMap(product => {
    const urls = [product.primary_image, ...product.gallery_images].filter(Boolean);
    return urls.map((src, index) => ({
      key: `${product.slug}-${index}`,
      src,
      alt: index === 0 ? product.inventory_name : `${product.inventory_name} gallery`,
      name: product.inventory_name,
    }));
  });

  return (
    <section className="launchpad-panel rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Floor inventory photos
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            These are the product photos on the live or preview website, not the
            logo and category slots above. Add or replace them on the Inventory tab.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold">
          <Link href={workspaceRoute("inventory", clientId)}>Open Inventory</Link>
        </Button>
      </div>

      {workspaceQuery.isLoading || listQuery.isLoading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : workspace?.blockedBy ? (
        <p className="mt-3 text-xs text-muted-foreground">{workspace.blockedBy}</p>
      ) : photos.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          No product photos yet. Upload them on the Inventory tab.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {photos.map(photo => (
            <figure key={photo.key} className="min-w-0">
              <InventoryPhoto
                src={photo.src}
                alt={photo.alt}
                className="h-20 w-full rounded-md border border-border object-cover"
              />
              <figcaption className="mt-1 truncate text-[11px] text-muted-foreground">
                {photo.name}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
