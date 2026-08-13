import { ClientAssetsFields } from "@/components/client/ClientAssetsFields";
import { ClientDetailsFields } from "@/components/client/ClientDetailsFields";
import { ClientSecretsFields } from "@/components/client/ClientSecretsFields";
import {
  EMPTY_DETAILS,
  EMPTY_SETUP,
  toDataUrl,
  type FieldErrors,
  type FormDetails,
} from "@/components/client/clientEditorForm";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
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
} from "@shared/client";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Rocket, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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
      const expectedUpdatedAt = clientQuery.data?.client.updatedAt;
      if (!expectedUpdatedAt) {
        toast.error("Reload and try again.");
        return;
      }
      updateMutation.mutate({
        clientId,
        ...valid,
        expectedUpdatedAt,
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
          <ClientDetailsFields details={details} errors={errors} setDetails={setDetails} />
          <ClientSecretsFields
            setup={setup}
            errors={errors}
            secretStatus={clientQuery.data?.secretStatus}
            setSetup={setSetup}
          />
          <ClientAssetsFields
            clientId={clientId}
            assetMap={assetMap}
            uploadingSlot={uploadingSlot}
            saving={saving}
            onFile={uploadFile}
          />

          <div className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-card/65 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-extrabold">Save your work</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">You can come back and finish later.</p>
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
                  {(clientQuery.data?.readiness.total ?? 0) - (clientQuery.data?.readiness.completed ?? 0)} items left
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
