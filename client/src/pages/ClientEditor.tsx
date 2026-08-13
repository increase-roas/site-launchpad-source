import { ImageUploadCard } from "@/components/ImageUploadCard";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ASSET_SLOT_LABELS,
  BUSINESS_DAY_VALUES,
  MARKETING_ASSET_SLOT_VALUES,
  SECRET_FIELD_LABELS,
  SECRET_FIELD_VALUES,
  buildReadiness,
  clientInputSchema,
  emptySecretStatus,
  isAssetSlot,
  secretSetupInputSchema,
  type AssetSlot,
  type ClientInput,
  type SecretField,
  type SecretStatus,
  type ThemeValue,
} from "@shared/client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Loader2,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { CATEGORY_OPTIONS, DAY_LABELS, THEME_OPTIONS } from "@/components/client/clientEditorOptions";

const PHOTO_GUIDANCE: Record<AssetSlot, string> = {
  logo: "Use a clear logo on a simple background.",
  hero: "Choose the strongest wide showroom or product photo.",
  hotTubs: "Choose a photo that clearly shows hot tubs.",
  swimSpas: "Choose a photo that clearly shows swim spas.",
  showroom: "Choose a wide photo of the showroom.",
  product: "Choose a clean close-up product photo.",
  delivery: "Choose a delivery or installation photo.",
};

type FormDetails = Omit<ClientInput, "foundedYear" | "theme"> & {
  foundedYear: string;
  theme: ThemeValue | "";
};

const defaultHours = BUSINESS_DAY_VALUES.map((day, index) => ({
  day,
  isOpen: index < 5,
  opensAt: "09:00",
  closesAt: "17:00",
}));

const EMPTY_DETAILS: FormDetails = {
  businessName: "",
  shortName: "",
  phone: "",
  email: "",
  streetAddress: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  websiteUrl: "",
  foundedYear: "",
  tagline: "",
  theme: "",
  businessHours: defaultHours,
  facebookUrl: "",
  googleMapsUrl: "",
  productCategories: [],
  primaryOffer: "",
  financingPromise: "",
  deliveryPromise: "",
};

const EMPTY_SETUP: Record<SecretField, string> = {
  metaPixelId: "",
  ga4MeasurementId: "",
  clarityId: "",
  ghlApiKey: "",
  ghlWebhookUrl: "",
  cloudflareProjectName: "",
};

type FieldErrors = Record<string, string>;

function FormField({
  label,
  error,
  hint,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
        {label}
        {!required ? <span className="font-semibold text-muted-foreground">Optional</span> : null}
      </span>
      {children}
      {error ? (
        <span className="flex items-center gap-1.5 text-sm font-bold text-red-300">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="block text-sm font-medium leading-relaxed text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Store;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
        <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That photo could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function ClientEditor({ clientId }: { clientId?: number }) {
  const isNew = !clientId;
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const queryInput = useMemo(() => ({ clientId: clientId ?? 0 }), [clientId]);
  const clientQuery = trpc.clients.get.useQuery(queryInput, { enabled: Boolean(clientId) });
  const [details, setDetails] = useState<FormDetails>(EMPTY_DETAILS);
  const [setup, setSetup] = useState<Record<SecretField, string>>(EMPTY_SETUP);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hydratedClientId, setHydratedClientId] = useState<number | undefined>();
  const [uploadingSlot, setUploadingSlot] = useState<AssetSlot | null>(null);

  useEffect(() => {
    const view = clientQuery.data;
    if (!view || hydratedClientId === view.client.id) return;

    setDetails({
      businessName: view.client.businessName,
      shortName: view.client.shortName,
      phone: view.client.phone,
      email: view.client.email,
      streetAddress: view.client.streetAddress,
      city: view.client.city,
      state: view.client.state,
      postalCode: view.client.postalCode,
      country: view.client.country,
      websiteUrl: view.client.websiteUrl,
      foundedYear: String(view.client.foundedYear),
      tagline: view.client.tagline,
      theme: view.client.theme,
      businessHours: view.client.businessHours,
      facebookUrl: view.client.facebookUrl,
      googleMapsUrl: view.client.googleMapsUrl,
      productCategories: view.client.productCategories,
      primaryOffer: view.client.primaryOffer,
      financingPromise: view.client.financingPromise,
      deliveryPromise: view.client.deliveryPromise,
    });
    setHydratedClientId(view.client.id);
  }, [clientQuery.data, hydratedClientId]);

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: async view => {
      await utils.clients.list.invalidate();
      toast.success("Client saved. Add the logo and photos next.");
      setLocation(`/workspace/${view.client.id}/settings`);
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: async view => {
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.clients.get.invalidate({ clientId: view.client.id }),
      ]);
      toast.success("Changes saved.");
    },
    onError: error => toast.error(error.message),
  });

  const uploadMutation = trpc.clients.uploadAsset.useMutation({
    onSuccess: async view => {
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.clients.get.invalidate({ clientId: view.client.id }),
      ]);
      toast.success("Photo added.");
    },
    onError: error => toast.error(error.message),
    onSettled: () => setUploadingSlot(null),
  });

  const launchMutation = trpc.clients.launch.useMutation({
    onSuccess: async view => {
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.clients.get.invalidate({ clientId: view.client.id }),
      ]);
      toast.success("Client is ready for deployment.", {
        description: "The site was not deployed. Alex can handle that next.",
      });
    },
    onError: error => toast.error(error.message),
  });

  const parsedDetails = clientInputSchema.safeParse({
    ...details,
    foundedYear: Number(details.foundedYear),
  });
  const localSecretStatus = SECRET_FIELD_VALUES.reduce<SecretStatus>((status, field) => {
    status[field] = Boolean(setup[field].trim()) || Boolean(clientQuery.data?.secretStatus[field]);
    return status;
  }, emptySecretStatus());
  const localReadiness = buildReadiness(
    parsedDetails.success ? parsedDetails.data : { theme: details.theme || undefined },
    clientQuery.data?.assets.map(asset => asset.slot).filter(isAssetSlot) ?? [],
    localSecretStatus,
  );
  const shownReadiness = clientQuery.data?.readiness ?? localReadiness;
  const assetMap = new Map(clientQuery.data?.assets.map(asset => [asset.slot, asset]) ?? []);
  const saving = createMutation.isPending || updateMutation.isPending;

  const validate = (): { details: ClientInput; setup: Record<SecretField, string> } | null => {
    const nextErrors: FieldErrors = {};
    const detailsResult = clientInputSchema.safeParse({
      ...details,
      foundedYear: Number(details.foundedYear),
    });
    const setupResult = secretSetupInputSchema.safeParse(setup);

    if (!detailsResult.success) {
      for (const issue of detailsResult.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    if (!setupResult.success) {
      for (const issue of setupResult.error.issues) {
        const key = String(issue.path[0] ?? "setup");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }

    setErrors(nextErrors);
    if (!detailsResult.success || !setupResult.success) {
      requestAnimationFrame(() => errorSummaryRef.current?.scrollIntoView({ behavior: "smooth" }));
      toast.error("A few items need attention.");
      return null;
    }

    return {
      details: detailsResult.data,
      setup: setupResult.data as Record<SecretField, string>,
    };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const valid = validate();
    if (!valid) return;

    if (clientId) {
      updateMutation.mutate({
        clientId,
        ...valid,
        expectedUpdatedAt: clientQuery.data?.client.updatedAt,
      });
    } else {
      createMutation.mutate(valid);
    }
  };

  const uploadFile = async (slot: AssetSlot, file: File) => {
    if (!clientId || uploadingSlot) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Choose an image smaller than 20 MB.");
      return;
    }

    try {
      setUploadingSlot(slot);
      const dataUrl = await toDataUrl(file);
      uploadMutation.mutate({ clientId, slot, originalFilename: file.name, dataUrl });
    } catch (error) {
      setUploadingSlot(null);
      toast.error(error instanceof Error ? error.message : "That photo could not be read.");
    }
  };

  if (!isNew && clientQuery.isLoading) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-300" />
          <p className="mt-4 font-bold text-muted-foreground">Opening client…</p>
        </div>
      </div>
    );
  }

  if (!isNew && clientQuery.error) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center">
        <AlertCircle className="mx-auto h-9 w-9 text-red-300" />
        <h1 className="mt-4 text-2xl font-extrabold">This client could not be opened</h1>
        <p className="mt-2 font-medium text-muted-foreground">Go back and try again.</p>
        <Button
          type="button"
          size="lg"
          onClick={() => setLocation("/")}
          className="mt-6 h-12 bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
        >
          Back to clients
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-[1540px] pb-16 sm:p-2 lg:p-5">
      <header className="mb-7 flex flex-col gap-5 sm:mb-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLocation(clientId ? `/workspace/${clientId}/pages` : "/")}
            className="-ml-3 h-11 gap-2 text-base font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to clients
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
              {isNew ? "Add a new client" : details.businessName || "Client setup"}
            </h1>
            {!isNew && clientQuery.data ? (
              <StatusDot
                good={
                  (clientQuery.data.client.status === "ready" ||
                    clientQuery.data.client.status === "live") &&
                  clientQuery.data.readiness.isComplete
                }
                label={
                  clientQuery.data.client.status === "live"
                    ? "Live"
                    : clientQuery.data.client.status === "ready"
                      ? "Ready"
                      : "Needs items"
                }
              />
            ) : null}
          </div>
          <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
            {isNew
              ? "Fill in the client details. You will add the logo and photos after saving."
              : "Work through the page from top to bottom. The checklist updates as items are finished."}
          </p>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="h-14 w-full gap-2 rounded-2xl bg-cyan-400 px-6 text-base font-extrabold text-slate-950 shadow-[0_12px_35px_rgba(34,211,238,0.2)] hover:bg-cyan-300 lg:w-auto"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isNew ? "Save and add photos" : "Save changes"}
        </Button>
      </header>

      {Object.keys(errors).length > 0 ? (
        <div
          ref={errorSummaryRef}
          className="mb-6 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-5"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <h2 className="font-extrabold text-red-200">A few items need attention</h2>
              <p className="mt-1 text-sm font-medium text-red-100/70">
                Look for the red message under each item, fix it, and save again.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
            <SectionHeading
              icon={Store}
              eyebrow="Step 1"
              title="Business details"
              description="Enter the information customers should see on the website."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Business name" error={errors.businessName}>
                <Input
                  value={details.businessName}
                  onChange={event => setDetails(current => ({ ...current, businessName: event.target.value }))}
                  placeholder="Paradise Spas"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField
                label="Short name"
                error={errors.shortName}
                hint="A simple name your team will recognize."
              >
                <Input
                  value={details.shortName}
                  onChange={event => setDetails(current => ({ ...current, shortName: event.target.value }))}
                  placeholder="Paradise"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField
                label="Phone number"
                error={errors.phone}
                hint="Include + and country code, such as +17015551234."
              >
                <Input
                  type="tel"
                  value={details.phone}
                  onChange={event => setDetails(current => ({ ...current, phone: event.target.value }))}
                  placeholder="+17015551234"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="Email address" error={errors.email}>
                <Input
                  type="email"
                  value={details.email}
                  onChange={event => setDetails(current => ({ ...current, email: event.target.value }))}
                  placeholder="hello@business.com"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="Website address" error={errors.websiteUrl}>
                <Input
                  type="url"
                  value={details.websiteUrl}
                  onChange={event => setDetails(current => ({ ...current, websiteUrl: event.target.value }))}
                  placeholder="https://business.com"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="Founded year" error={errors.foundedYear}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={details.foundedYear}
                  onChange={event => setDetails(current => ({ ...current, foundedYear: event.target.value }))}
                  placeholder="1994"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Tagline" error={errors.tagline}>
                  <Input
                    value={details.tagline}
                    onChange={event => setDetails(current => ({ ...current, tagline: event.target.value }))}
                    placeholder="Relaxation starts here."
                    className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                  />
                </FormField>
              </div>
            </div>

            <div className="my-7 h-px bg-white/8" />
            <h3 className="mb-4 text-lg font-extrabold">Business address</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Street address" error={errors.streetAddress}>
                  <Input
                    value={details.streetAddress}
                    onChange={event => setDetails(current => ({ ...current, streetAddress: event.target.value }))}
                    placeholder="123 Main Street"
                    className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                  />
                </FormField>
              </div>
              <FormField label="City" error={errors.city}>
                <Input
                  value={details.city}
                  onChange={event => setDetails(current => ({ ...current, city: event.target.value }))}
                  placeholder="Minot"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="State or region" error={errors.state}>
                <Input
                  value={details.state}
                  onChange={event => setDetails(current => ({ ...current, state: event.target.value }))}
                  placeholder="North Dakota"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="ZIP or postal code" error={errors.postalCode}>
                <Input
                  value={details.postalCode}
                  onChange={event => setDetails(current => ({ ...current, postalCode: event.target.value }))}
                  placeholder="58701"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="Country" error={errors.country}>
                <Input
                  value={details.country}
                  onChange={event => setDetails(current => ({ ...current, country: event.target.value }))}
                  placeholder="United States"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
            </div>

            <div className="my-7 h-px bg-white/8" />
            <h3 className="mb-4 text-lg font-extrabold">Social and map links</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Facebook page" error={errors.facebookUrl}>
                <Input
                  type="url"
                  value={details.facebookUrl}
                  onChange={event => setDetails(current => ({ ...current, facebookUrl: event.target.value }))}
                  placeholder="https://facebook.com/business"
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
              <FormField label="Google Maps link" error={errors.googleMapsUrl}>
                <Input
                  type="url"
                  value={details.googleMapsUrl}
                  onChange={event => setDetails(current => ({ ...current, googleMapsUrl: event.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                  className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                />
              </FormField>
            </div>
          </Card>

          <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
            <SectionHeading
              icon={Sparkles}
              eyebrow="Step 2"
              title="Look and products"
              description="Choose one website style and the products this client sells."
            />
            <fieldset>
              <legend className="text-sm font-extrabold">Website theme</legend>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {THEME_OPTIONS.map(option => {
                  const selected = details.theme === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                        selected
                          ? "border-cyan-400 bg-cyan-400/8 ring-2 ring-cyan-400/15"
                          : "border-white/9 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={selected}
                        onChange={() => setDetails(current => ({ ...current, theme: option.value }))}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        {option.swatches.map(color => (
                          <span
                            key={color}
                            className="h-8 flex-1 rounded-lg ring-1 ring-white/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <p className="mt-4 text-lg font-extrabold">{option.label}</p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
                        {option.description}
                      </p>
                    </label>
                  );
                })}
              </div>
              {errors.theme ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
                  <AlertCircle className="h-4 w-4" /> {errors.theme}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="mt-7">
              <legend className="text-sm font-extrabold">Products they sell</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {CATEGORY_OPTIONS.map(option => {
                  const checked = details.productCategories.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                        checked
                          ? "border-cyan-400/45 bg-cyan-400/7"
                          : "border-white/9 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={next =>
                          setDetails(current => ({
                            ...current,
                            productCategories: next
                              ? [...current.productCategories, option.value]
                              : current.productCategories.filter(value => value !== option.value),
                          }))
                        }
                        className="h-6 w-6 border-white/25 data-[state=checked]:border-cyan-400 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950"
                      />
                      <span className="text-base font-extrabold">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.productCategories ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
                  <AlertCircle className="h-4 w-4" /> {errors.productCategories}
                </p>
              ) : null}
            </fieldset>
          </Card>

          <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
            <SectionHeading
              icon={Clock3}
              eyebrow="Step 3"
              title="Hours of operation"
              description="Turn off any closed day. For open days, choose the opening and closing time."
            />
            <div className="space-y-3">
              {details.businessHours.map((hour, index) => (
                <div
                  key={hour.day}
                  className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:grid-cols-[150px_1fr] sm:items-center"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={hour.isOpen}
                      onCheckedChange={checked =>
                        setDetails(current => ({
                          ...current,
                          businessHours: current.businessHours.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, isOpen: Boolean(checked) } : item,
                          ),
                        }))
                      }
                      className="h-6 w-6 border-white/25 data-[state=checked]:border-cyan-400 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950"
                    />
                    <span className="font-extrabold">{DAY_LABELS[hour.day]}</span>
                  </label>
                  {hour.isOpen ? (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${DAY_LABELS[hour.day]} opening time`}
                        value={hour.opensAt}
                        onChange={event =>
                          setDetails(current => ({
                            ...current,
                            businessHours: current.businessHours.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, opensAt: event.target.value } : item,
                            ),
                          }))
                        }
                        className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                      />
                      <span className="text-sm font-bold text-muted-foreground">to</span>
                      <Input
                        type="time"
                        aria-label={`${DAY_LABELS[hour.day]} closing time`}
                        value={hour.closesAt}
                        onChange={event =>
                          setDetails(current => ({
                            ...current,
                            businessHours: current.businessHours.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, closesAt: event.target.value } : item,
                            ),
                          }))
                        }
                        className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/[0.025] px-4 py-3 text-sm font-bold text-muted-foreground">
                      Closed
                    </div>
                  )}
                </div>
              ))}
            </div>
            {errors.businessHours ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
                <AlertCircle className="h-4 w-4" /> {errors.businessHours}
              </p>
            ) : null}
          </Card>

          <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
            <SectionHeading
              icon={Sparkles}
              eyebrow="Step 4"
              title="Offers and promises"
              description="Use the exact wording this client wants customers to see."
            />
            <div className="space-y-5">
              <FormField label="Primary offer" error={errors.primaryOffer}>
                <Textarea
                  value={details.primaryOffer}
                  onChange={event => setDetails(current => ({ ...current, primaryOffer: event.target.value }))}
                  placeholder="Save up to $2,500 on select models this month."
                  className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
                />
              </FormField>
              <FormField label="Financing promise" error={errors.financingPromise}>
                <Textarea
                  value={details.financingPromise}
                  onChange={event =>
                    setDetails(current => ({ ...current, financingPromise: event.target.value }))
                  }
                  placeholder="Flexible monthly payment options are available."
                  className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
                />
              </FormField>
              <FormField label="Delivery promise" error={errors.deliveryPromise}>
                <Textarea
                  value={details.deliveryPromise}
                  onChange={event =>
                    setDetails(current => ({ ...current, deliveryPromise: event.target.value }))
                  }
                  placeholder="Local delivery and setup are available."
                  className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
                />
              </FormField>
            </div>
          </Card>

          <Card className="border-amber-300/15 bg-[linear-gradient(145deg,rgba(120,83,22,0.10),rgba(23,29,38,0.92))] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
            <SectionHeading
              icon={ShieldCheck}
              eyebrow="Step 5"
              title="Technical Setup (ask Alex)"
              description="If you do not have these, ask Alex. Saved values stay hidden."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {SECRET_FIELD_VALUES.map(field => {
                const filled = Boolean(setup[field].trim()) || Boolean(clientQuery.data?.secretStatus[field]);
                const isWide = field === "ghlApiKey" || field === "ghlWebhookUrl";
                return (
                  <div key={field} className={isWide ? "sm:col-span-2" : ""}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor={`setup-${field}`} className="text-sm font-extrabold">
                        {SECRET_FIELD_LABELS[field]}
                      </label>
                      <StatusDot good={filled} label={filled ? "Filled" : "Missing"} compact />
                    </div>
                    <Input
                      id={`setup-${field}`}
                      type={field === "ghlApiKey" ? "password" : field === "ghlWebhookUrl" ? "url" : "text"}
                      autoComplete="off"
                      value={setup[field]}
                      onChange={event =>
                        setSetup(current => ({ ...current, [field]: event.target.value }))
                      }
                      placeholder={
                        clientQuery.data?.secretStatus[field]
                          ? "Saved — type here only to replace it"
                          : `Enter ${SECRET_FIELD_LABELS[field]}`
                      }
                      className="h-12 rounded-xl border-white/10 bg-black/15 text-base"
                    />
                    {errors[field] ? (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-300">
                        <AlertCircle className="h-4 w-4" /> {errors[field]}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

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
                      onFile={file => uploadFile("logo", file)}
                    />
                  </div>
                </div>
                <div className="h-px bg-white/8" />
                <div>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-extrabold">Marketing photos</h3>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        Add all six photos before launch.
                      </p>
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
                        onFile={file => uploadFile(slot, file)}
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

          <div className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-card/65 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-extrabold">Save your work</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                You can come back and finish later.
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="h-14 w-full gap-2 rounded-2xl bg-cyan-400 px-6 text-base font-extrabold text-slate-950 hover:bg-cyan-300 sm:w-auto"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isNew ? "Save and add photos" : "Save changes"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <ReadinessChecklist
            items={shownReadiness.items}
            completed={shownReadiness.completed}
            total={shownReadiness.total}
            percent={shownReadiness.percent}
          />

          {clientId ? (
            <section className="overflow-hidden rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,0.15),transparent_40%),rgba(19,27,37,0.96)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
                <Rocket className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Ready to launch?</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                Finish every checklist item to unlock the button. This only marks the client ready.
              </p>
              <Button
                type="button"
                size="lg"
                disabled={!clientQuery.data?.readiness.isComplete || launchMutation.isPending || saving}
                onClick={() => launchMutation.mutate({ clientId })}
                className="mt-5 h-14 w-full gap-2 rounded-2xl bg-emerald-400 text-base font-extrabold text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-muted-foreground"
              >
                {launchMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : clientQuery.data?.client.status === "ready" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Rocket className="h-5 w-5" />
                )}
                {clientQuery.data?.client.status === "ready" ? "Ready for deployment" : "Launch Site"}
              </Button>
              {!clientQuery.data?.readiness.isComplete ? (
                <p className="mt-3 text-center text-xs font-bold text-muted-foreground">
                  {(clientQuery.data?.readiness.total ?? 0) -
                    (clientQuery.data?.readiness.completed ?? 0)}{" "}
                  items left
                </p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-3xl border border-cyan-300/12 bg-cyan-400/[0.035] p-5 sm:p-6">
              <Rocket className="h-7 w-7 text-cyan-300" />
              <h2 className="mt-3 text-xl font-extrabold">Photos come next</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                Save these details, then add the logo and six required photos.
              </p>
            </section>
          )}
        </aside>
      </div>
    </form>
  );
}
