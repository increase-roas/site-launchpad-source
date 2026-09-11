import { EmptyPanelState, PanelCard } from "@/components/dashboard/PanelCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  configurationRoute,
  launchRoute,
} from "@/lib/workspaceNavigation";
import {
  INVENTORY_STATUSES,
  type InventoryEnvironmentKind,
  type InventoryProductView,
  type InventoryStatus,
} from "@shared/inventoryAdmin";
import {
  AlertTriangle,
  ExternalLink,
  ImagePlus,
  KeyRound,
  Loader2,
  Package,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_LABELS: Record<InventoryStatus, string> = {
  draft: "Draft (hidden)",
  available: "Available",
  pending: "Sale pending",
  sold: "Sold",
  hidden: "Hidden",
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type Draft = {
  slug: string;
  inventory_name: string;
  category: string;
  status: InventoryStatus;
  quantity: string;
  price: string;
  monthly_payment: string;
  sort_order: string;
  primary_image: string;
  gallery_images: string[];
  featured: boolean;
  promo_label: string;
  delivery_promise: string;
  headline: string;
  positioning_label: string;
  hero_description: string;
  long_description: string;
  best_for: string;
  quick_facts: string;
  why_bullets: string;
  ghl_tags: string;
};

function emptyDraft(category: string): Draft {
  return {
    slug: "",
    inventory_name: "",
    category,
    status: "draft",
    quantity: "1",
    price: "",
    monthly_payment: "",
    sort_order: "0",
    primary_image: "",
    gallery_images: [],
    featured: false,
    promo_label: "",
    delivery_promise: "",
    headline: "",
    positioning_label: "",
    hero_description: "",
    long_description: "",
    best_for: "",
    quick_facts: "",
    why_bullets: "",
    ghl_tags: "",
  };
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function productToDraft(product: InventoryProductView): Draft {
  return {
    slug: product.slug,
    inventory_name: product.inventory_name,
    category: product.category,
    status: product.status,
    quantity: String(product.quantity),
    price: product.price ? String(product.price) : "",
    monthly_payment: product.monthly_payment ? String(product.monthly_payment) : "",
    sort_order: String(product.sort_order),
    primary_image: product.primary_image,
    gallery_images: product.gallery_images,
    featured: Boolean(product.featured),
    promo_label: product.promo_label,
    delivery_promise: product.delivery_promise,
    headline: product.headline,
    positioning_label: product.positioning_label,
    hero_description: product.hero_description,
    long_description: product.long_description,
    best_for: product.best_for,
    quick_facts: product.quick_facts.join("\n"),
    why_bullets: product.why_bullets.join("\n"),
    ghl_tags: product.ghl_tags.join("\n"),
  };
}

function money(value: number): string {
  return value ? `$${value.toLocaleString()}` : "—";
}

function blockedAction(clientId: number, blockedBy: string): { href: string; label: string } {
  if (blockedBy.includes("Technical") || blockedBy.includes("D1")) {
    return { href: configurationRoute(clientId, "technical"), label: "Open Technical" };
  }
  if (blockedBy.includes("Content") || blockedBy.includes("category")) {
    return {
      href: configurationRoute(clientId, "content", "categories"),
      label: "Open Content",
    };
  }
  return { href: launchRoute(clientId), label: "Open Launch" };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("That photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function InventoryPage({ clientId }: { clientId: number }) {
  const workspaceQuery = trpc.inventory.workspace.useQuery({ clientId });
  const [environment, setEnvironment] = useState<InventoryEnvironmentKind | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(""));
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [galleryUrl, setGalleryUrl] = useState("");

  const workspace = workspaceQuery.data;
  const selectedTarget =
    workspace?.targets.find(target => target.kind === environment) ??
    workspace?.targets.find(target => target.kind === workspace.environment) ??
    workspace?.targets[0] ??
    null;
  const selectedKind = selectedTarget?.kind;

  useEffect(() => {
    if (!workspace || environment) return;
    setEnvironment(workspace.environment);
  }, [workspace, environment]);

  useEffect(() => {
    if (!workspace || draft.category) return;
    const first = workspace.categories[0]?.slug ?? "";
    if (first) setDraft(current => ({ ...current, category: first }));
  }, [workspace, draft.category]);

  const listQuery = trpc.inventory.list.useQuery(
    { clientId, environment: selectedKind },
    { enabled: Boolean(selectedKind) },
  );
  const utils = trpc.useUtils();

  const refresh = async () => {
    await Promise.all([
      utils.inventory.workspace.invalidate({ clientId }),
      selectedKind
        ? utils.inventory.list.invalidate({ clientId, environment: selectedKind })
        : Promise.resolve(),
    ]);
  };

  const save = trpc.inventory.save.useMutation({
    onSuccess: async () => {
      toast.success(editingSlug ? "Product saved." : "Product added.");
      setDraft(emptyDraft(workspace?.categories[0]?.slug ?? ""));
      setEditingSlug(null);
      setGalleryUrl("");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const setStatus = trpc.inventory.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status updated.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const upload = trpc.inventory.upload.useMutation({
    onError: error => toast.error(error.message),
  });

  const products = listQuery.data?.products ?? [];
  const orphans = useMemo(
    () => products.filter(product => product.orphaned),
    [products],
  );

  const patchDraft = (partial: Partial<Draft>) =>
    setDraft(current => ({ ...current, ...partial }));

  const fillProduct = (product: InventoryProductView) => {
    setDraft(productToDraft(product));
    setEditingSlug(product.slug);
    setGalleryUrl("");
    document.getElementById("inventory-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const resetForm = () => {
    setDraft(emptyDraft(workspace?.categories[0]?.slug ?? ""));
    setEditingSlug(null);
    setGalleryUrl("");
  };

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedKind) return;
    save.mutate({
      clientId,
      environment: selectedKind,
      product: {
        slug: draft.slug,
        inventory_name: draft.inventory_name,
        category: draft.category,
        status: draft.status,
        quantity: draft.quantity,
        price: draft.price,
        monthly_payment: draft.monthly_payment,
        sort_order: draft.sort_order,
        primary_image: draft.primary_image,
        gallery_images: draft.gallery_images,
        featured: draft.featured,
        promo_label: draft.promo_label,
        delivery_promise: draft.delivery_promise,
        headline: draft.headline,
        positioning_label: draft.positioning_label,
        hero_description: draft.hero_description,
        long_description: draft.long_description,
        best_for: draft.best_for,
        quick_facts: lines(draft.quick_facts),
        why_bullets: lines(draft.why_bullets),
        ghl_tags: lines(draft.ghl_tags),
      },
    });
  };

  const onUpload = async (file: File | undefined, into: "primary" | "gallery") => {
    if (!file || !selectedKind) return;
    if (!IMAGE_TYPES.has(file.type)) {
      toast.error("Use a JPG, PNG, WEBP, or GIF photo.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Choose a photo smaller than 6 MB.");
      return;
    }
    if (into === "gallery" && draft.gallery_images.length >= 20) {
      toast.error("A product can have 20 gallery photos.");
      return;
    }
    try {
      const bytes = await readFileAsBase64(file);
      const result = await upload.mutateAsync({
        clientId,
        environment: selectedKind,
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        bytes,
      });
      if (into === "primary") {
        setDraft(current => ({ ...current, primary_image: result.url }));
      } else {
        setDraft(current => ({
          ...current,
          gallery_images: [...current.gallery_images, result.url].slice(0, 20),
        }));
      }
      toast.success("Photo uploaded.");
    } catch {
      // upload.onError already surfaced the failure.
    }
  };

  const addGalleryUrl = () => {
    const value = galleryUrl.trim();
    if (!value) return;
    if (draft.gallery_images.length >= 20) {
      toast.error("A product can have 20 gallery photos.");
      return;
    }
    patchDraft({ gallery_images: [...draft.gallery_images, value] });
    setGalleryUrl("");
  };

  const removeGalleryImage = (url: string) => {
    setDraft(current => ({
      ...current,
      gallery_images: current.gallery_images.filter(item => item !== url),
    }));
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaceQuery.isError || !workspace) {
    return (
      <div className="launchpad-panel rounded-lg p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">Inventory could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {workspaceQuery.error?.message ??
            "This client's inventory workspace is unavailable."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => workspaceQuery.refetch()}
          className="mt-4 h-8 text-xs font-semibold"
        >
          Try again
        </Button>
      </div>
    );
  }

  const blocked = workspace.blockedBy;
  const cannotEdit = !selectedTarget || workspace.categories.length === 0;

  return (
    <div className="space-y-3 pb-6">
      <section className="launchpad-panel flex flex-wrap items-start justify-between gap-3 rounded-lg p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Floor inventory
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Add the hot tubs, spas, and other units this dealer has on the floor.
            These products appear on the live <span className="font-medium text-foreground">/inventory</span>{" "}
            page. Publishing the website does not wipe this list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workspace.targets.length > 1 ? (
            <div className="flex rounded-lg border border-border p-0.5">
              {workspace.targets.map(target => (
                <Button
                  key={target.kind}
                  type="button"
                  size="sm"
                  variant={selectedKind === target.kind ? "default" : "ghost"}
                  className="h-8 text-xs font-semibold"
                  onClick={() => setEnvironment(target.kind)}
                >
                  {target.label}
                </Button>
              ))}
            </div>
          ) : selectedTarget ? (
            <StatusBadge tone="info" label={selectedTarget.label} />
          ) : null}
          {selectedTarget?.adminUrl ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
              <a href={selectedTarget.adminUrl} target="_blank" rel="noreferrer">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Open site /admin
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {blocked ? (
        <section className="launchpad-panel flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Inventory is not ready yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{blocked}</p>
          </div>
          <Button asChild size="sm" className="h-9 text-xs font-semibold">
            <Link href={blockedAction(clientId, blocked).href}>
              {blockedAction(clientId, blocked).label}
            </Link>
          </Button>
        </section>
      ) : null}

      {!selectedTarget ? (
        <EmptyPanelState
          icon={<Package className="h-5 w-5" />}
          title="No inventory database yet"
          description="Generate a preview or publish the website first. Launchpad creates the product database at that point."
          action={
            <Button asChild size="sm" className="h-8 text-xs font-semibold">
              <Link href={launchRoute(clientId)}>Go to Launch</Link>
            </Button>
          }
        />
      ) : (
        <>
          <PanelCard
            title="Products"
            description={
              selectedTarget.ready
                ? `${products.length} unit${products.length === 1 ? "" : "s"} on ${selectedTarget.label.toLowerCase()}`
                : `${selectedTarget.label} is still finishing. You can add products once it is ready.`
            }
            bodyClassName="p-0"
          >
            {orphans.length > 0 ? (
              <p className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                {orphans.length} product{orphans.length === 1 ? " sits" : "s sit"} in a
                category this site no longer sells. Customers cannot see them. Delete
                them, or turn the category back on in Configuration → Content.
              </p>
            ) : null}
            {listQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : listQuery.isError ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold">Products could not be loaded</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listQuery.error.message}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 h-8 text-xs font-semibold"
                  onClick={() => listQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : products.length === 0 ? (
              <EmptyPanelState
                icon={<Package className="h-5 w-5" />}
                title="No products yet"
                description="Add the first floor unit below. Until then, the public inventory page stays empty."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Product
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Category
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Price
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Monthly
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Qty
                    </TableHead>
                    <TableHead className="w-40 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product.slug} className="border-border">
                      <TableCell className="px-4 py-3">
                        <p className="text-sm font-medium">{product.inventory_name}</p>
                        <p className="text-xs text-muted-foreground">{product.slug}</p>
                        {product.featured ? (
                          <p className="mt-1 text-[11px] font-medium text-foreground">
                            Featured
                          </p>
                        ) : null}
                        {product.orphaned ? (
                          <p className="mt-1 text-[11px] font-medium text-destructive">
                            Not sold here any more
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {workspace.categories.find(item => item.slug === product.category)
                          ?.label ?? product.category}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <select
                          aria-label={`Status for ${product.inventory_name}`}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                          value={product.status}
                          disabled={setStatus.isPending}
                          onChange={event =>
                            setStatus.mutate({
                              clientId,
                              environment: selectedKind,
                              slug: product.slug,
                              status: event.target.value as InventoryStatus,
                            })
                          }
                        >
                          {INVENTORY_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">{money(product.price)}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {product.monthly_payment ? `${money(product.monthly_payment)}/mo` : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">{product.quantity}</TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                            onClick={() => fillProduct(product)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold text-destructive"
                            disabled={setStatus.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Delete “${product.inventory_name}”? It is hidden, not erased.`,
                                )
                              ) {
                                return;
                              }
                              setStatus.mutate({
                                clientId,
                                environment: selectedKind,
                                slug: product.slug,
                                status: "deleted",
                              });
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelCard>

          <PanelCard
            title={editingSlug ? `Edit ${draft.inventory_name || "product"}` : "Add a product"}
            description="Name, category, and a photo are enough for the inventory card. The rest is optional."
          >
            <form id="inventory-form" className="space-y-4" onSubmit={onSave}>
              {workspace.categories.length === 0 ? (
                <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Turn on at least one product category in Configuration → Content before
                  adding units.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="inventory_name" label="Product name">
                  <Input
                    id="inventory_name"
                    required
                    value={draft.inventory_name}
                    onChange={event => patchDraft({ inventory_name: event.target.value })}
                  />
                </Field>
                <Field
                  id="slug"
                  label="URL slug"
                  hint="Leave blank to create it from the name."
                >
                  <Input
                    id="slug"
                    value={draft.slug}
                    onChange={event => patchDraft({ slug: event.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="category" label="Category">
                  <Select
                    value={draft.category}
                    onValueChange={value => patchDraft({ category: value })}
                    disabled={workspace.categories.length === 0}
                  >
                    <SelectTrigger id="category" className="w-full">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspace.categories.map(category => (
                        <SelectItem key={category.slug} value={category.slug}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="status" label="Status">
                  <Select
                    value={draft.status}
                    onValueChange={value =>
                      patchDraft({ status: value as InventoryStatus })
                    }
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="quantity" label="Quantity">
                  <Input
                    id="quantity"
                    type="number"
                    min={0}
                    value={draft.quantity}
                    onChange={event => patchDraft({ quantity: event.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="price" label="Cash price ($)">
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={event => patchDraft({ price: event.target.value })}
                  />
                </Field>
                <Field id="monthly_payment" label="Monthly ($)">
                  <Input
                    id="monthly_payment"
                    type="number"
                    min={0}
                    value={draft.monthly_payment}
                    onChange={event =>
                      patchDraft({ monthly_payment: event.target.value })
                    }
                  />
                </Field>
                <Field id="sort_order" label="Sort order">
                  <Input
                    id="sort_order"
                    type="number"
                    value={draft.sort_order}
                    onChange={event => patchDraft({ sort_order: event.target.value })}
                  />
                </Field>
              </div>

              <Field
                id="imageFile"
                label="Main photo"
                hint={
                  selectedTarget.r2PublicUrl
                    ? "JPG, PNG, WEBP or GIF, up to 6 MB."
                    : "Image hosting is not ready yet. Paste an https:// URL instead."
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="imageFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={upload.isPending || !selectedTarget.r2PublicUrl}
                    onChange={event => {
                      void onUpload(event.target.files?.[0], "primary");
                      event.target.value = "";
                    }}
                  />
                  {upload.isPending ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Uploading
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      Optional
                    </span>
                  )}
                </div>
              </Field>
              <Field
                id="primary_image"
                label="Photo URL"
                hint="Must start with / or https://"
              >
                <Input
                  id="primary_image"
                  value={draft.primary_image}
                  onChange={event => patchDraft({ primary_image: event.target.value })}
                  placeholder="/images/x.webp or https://…"
                />
              </Field>
              {draft.primary_image ? (
                <img
                  src={draft.primary_image}
                  alt=""
                  className="h-28 w-40 rounded-md border border-border object-cover"
                />
              ) : null}

              <Field
                id="galleryFile"
                label="Gallery photos"
                hint="Extra views on the product page. Up to 20. Same file rules as the main photo."
              >
                <Input
                  id="galleryFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={upload.isPending || !selectedTarget.r2PublicUrl}
                  onChange={event => {
                    void onUpload(event.target.files?.[0], "gallery");
                    event.target.value = "";
                  }}
                />
              </Field>
              {draft.gallery_images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {draft.gallery_images.map(url => (
                    <div key={url} className="relative overflow-hidden rounded-md border border-border">
                      <img src={url} alt="" className="h-24 w-full object-cover" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-1 top-1 h-7 px-2 text-[11px] font-semibold"
                        onClick={() => removeGalleryImage(url)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Field
                id="gallery_url"
                label="Add gallery URL"
                hint="Must start with / or https://"
              >
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="gallery_url"
                    value={galleryUrl}
                    placeholder="/images/x.webp or https://…"
                    onChange={event => setGalleryUrl(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addGalleryUrl();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold"
                    onClick={addGalleryUrl}
                  >
                    Add URL
                  </Button>
                </div>
              </Field>

              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  id="featured"
                  checked={draft.featured}
                  onCheckedChange={checked => patchDraft({ featured: checked === true })}
                />
                <div>
                  <Label htmlFor="featured" className="text-sm font-medium">
                    Featured
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Show this unit first on inventory and category pages.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="promo_label" label="Badge">
                  <Input
                    id="promo_label"
                    value={draft.promo_label}
                    onChange={event => patchDraft({ promo_label: event.target.value })}
                    placeholder="LAST ONE"
                  />
                </Field>
                <Field id="delivery_promise" label="Delivery promise">
                  <Input
                    id="delivery_promise"
                    value={draft.delivery_promise}
                    onChange={event =>
                      patchDraft({ delivery_promise: event.target.value })
                    }
                    placeholder="Delivery in 2 weeks"
                  />
                </Field>
              </div>

              <Field
                id="quick_facts"
                label="Quick facts"
                hint="One per line. The first three show on the card."
              >
                <Textarea
                  id="quick_facts"
                  rows={3}
                  value={draft.quick_facts}
                  onChange={event => patchDraft({ quick_facts: event.target.value })}
                />
              </Field>
              <Field id="why_bullets" label="Why this one" hint="One per line">
                <Textarea
                  id="why_bullets"
                  rows={3}
                  value={draft.why_bullets}
                  onChange={event => patchDraft({ why_bullets: event.target.value })}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="headline" label="Headline">
                  <Input
                    id="headline"
                    value={draft.headline}
                    onChange={event => patchDraft({ headline: event.target.value })}
                  />
                </Field>
                <Field id="positioning_label" label="Positioning label">
                  <Input
                    id="positioning_label"
                    value={draft.positioning_label}
                    onChange={event =>
                      patchDraft({ positioning_label: event.target.value })
                    }
                    placeholder="Most popular"
                  />
                </Field>
              </div>

              <Field id="hero_description" label="Short description">
                <Textarea
                  id="hero_description"
                  rows={2}
                  value={draft.hero_description}
                  onChange={event =>
                    patchDraft({ hero_description: event.target.value })
                  }
                />
              </Field>
              <Field id="long_description" label="Long description">
                <Textarea
                  id="long_description"
                  rows={4}
                  value={draft.long_description}
                  onChange={event =>
                    patchDraft({ long_description: event.target.value })
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="best_for" label="Best for">
                  <Input
                    id="best_for"
                    value={draft.best_for}
                    onChange={event => patchDraft({ best_for: event.target.value })}
                  />
                </Field>
                <Field id="ghl_tags" label="CRM tags" hint="One per line">
                  <Textarea
                    id="ghl_tags"
                    rows={2}
                    value={draft.ghl_tags}
                    onChange={event => patchDraft({ ghl_tags: event.target.value })}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 text-xs font-semibold"
                  disabled={cannotEdit || save.isPending}
                >
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {editingSlug ? "Save changes" : "Save product"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs font-semibold"
                  onClick={resetForm}
                >
                  Clear
                </Button>
              </div>
            </form>
          </PanelCard>
        </>
      )}
    </div>
  );
}
