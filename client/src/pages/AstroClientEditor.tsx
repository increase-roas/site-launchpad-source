import { BasicInfoTab } from "@/components/astro/BasicInfoTab";
import { BrandingTab } from "@/components/astro/BrandingTab";
import { ContentTab } from "@/components/astro/ContentTab";
import { MediaTab } from "@/components/astro/MediaTab";
import { ReadinessStrip } from "@/components/astro/ReadinessStrip";
import { TechnicalTab } from "@/components/astro/TechnicalTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { uploadAssetDirectly, type AssetUploadResult } from "@/lib/assetUpload";
import { trpc } from "@/lib/trpc";
import {
  configSectionElementId,
  parseConfigurationSearch,
  tabForConfigSection,
} from "@/lib/workspaceNavigation";
import { imageUploadRejectionMessage } from "@shared/assetUpload";
import {
  astroClientConfigInputSchema,
  type AstroAssetSlot,
  type AstroClientConfigInput,
  type WranglerSecretName,
} from "@shared/astroConfig";
import {
  summarizeAstroConfigReadiness,
  type ConfigSectionId,
  type ConfigTabId,
} from "@shared/astroConfigReadiness";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  saveClientIdForMountedEditor,
  shouldClearDirtyAfterSave,
  shouldHydrateEditor,
} from "./editorIsolation";

type SaveState = "idle" | "pending" | "saving" | "saved" | "invalid" | "error";

export default function AstroClientEditor({ clientId }: { clientId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ clientId }), [clientId]);
  const query = trpc.astroConfig.get.useQuery(queryInput, {
    retry: 1,
    retryDelay: 250,
  });
  const libraryQuery = trpc.assets.listLibrary.useQuery(queryInput);
  const [config, setConfig] = useState<AstroClientConfigInput | null>(null);
  const [assets, setAssets] = useState<Array<{ slot: string; storageUrl: string; filename: string; byteSize: number; mediaItemId?: number | null; alt?: string; description?: string }>>([]);
  const [secretStatus, setSecretStatus] = useState<Record<WranglerSecretName, boolean> | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<AstroAssetSlot | null>(null);
  const uploadInFlightRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hydratedForClientIdRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const configRef = useRef<AstroClientConfigInput | null>(null);
  const saveInFlightRef = useRef(false);
  const trailingSaveRef = useRef(false);
  const inFlightPayloadRef = useRef("");
  const mountedClientIdRef = useRef(clientId);
  mountedClientIdRef.current = clientId;
  const [activeTab, setActiveTab] = useState<ConfigTabId>(
    () => parseConfigurationSearch(window.location.search).tab,
  );
  const pendingSectionRef = useRef<ConfigSectionId | null>(
    parseConfigurationSearch(window.location.search).section,
  );
  const selectTab = (tab: ConfigTabId) => {
    pendingSectionRef.current = null;
    setActiveTab(tab);
    window.history.replaceState({}, "", `${window.location.pathname}?tab=${tab}`);
  };
  const readiness = useMemo(
    () => (config ? summarizeAstroConfigReadiness(config, assets, secretStatus ?? undefined) : null),
    [config, assets, secretStatus],
  );

  useEffect(() => {
    if (!query.data || !shouldHydrateEditor(hydratedForClientIdRef.current, clientId)) return;
    setConfig(query.data.input);
    configRef.current = query.data.input;
    setAssets(query.data.assets.map(asset => ({
      slot: asset.slot,
      storageUrl: asset.storageUrl,
      filename: asset.filename,
      byteSize: asset.byteSize,
      mediaItemId: asset.mediaItemId ?? undefined,
    })));
    setSecretStatus(query.data.secretStatus);
    setSaveState("saved");
    dirtyRef.current = false;
    hydratedForClientIdRef.current = clientId;
  }, [query.data, clientId]);

  useEffect(() => {
    const section = pendingSectionRef.current;
    if (!config || !section || activeTab !== tabForConfigSection(section)) return;

    let cancelled = false;
    let attempts = 0;
    const scrollToSection = () => {
      if (cancelled) return;
      const node = document.getElementById(configSectionElementId(section));
      if (node) {
        pendingSectionRef.current = null;
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        node.focus({ preventScroll: true });
        return;
      }
      attempts += 1;
      if (attempts < 16) window.requestAnimationFrame(scrollToSection);
    };
    const frame = window.requestAnimationFrame(scrollToSection);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [config, activeTab]);


  const requestUploadMutation = trpc.assets.requestUpload.useMutation();
  const completeUploadMutation = trpc.assets.completeUpload.useMutation();

  const saveMutation = trpc.astroConfig.save.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: view => {
      setAssets(view.assets.map(asset => ({
        slot: asset.slot,
        storageUrl: asset.storageUrl,
        filename: asset.filename,
        byteSize: asset.byteSize,
        mediaItemId: asset.mediaItemId ?? undefined,
      })));
      setSecretStatus(view.secretStatus);
      utils.astroConfig.get.setData(queryInput, view);
      const currentPayload = JSON.stringify(configRef.current);
      const needsTrailing =
        trailingSaveRef.current || !shouldClearDirtyAfterSave(inFlightPayloadRef.current, currentPayload);
      trailingSaveRef.current = false;
      saveInFlightRef.current = false;
      if (needsTrailing && configRef.current) {
        dirtyRef.current = true;
        setSaveState("pending");
        return;
      }
      dirtyRef.current = false;
      setSaveState("saved");
      void utils.clients.list.invalidate();
    },
    onError: error => {
      saveInFlightRef.current = false;
      trailingSaveRef.current = false;
      setSaveState("error");
      toast.error(error.message);
    },
  });

  const saveNow = () => {
    const current = configRef.current;
    const targetClientId = saveClientIdForMountedEditor(mountedClientIdRef.current, clientId);
    if (!current || targetClientId === null) return;
    if (saveInFlightRef.current || saveMutation.isPending) {
      trailingSaveRef.current = dirtyRef.current;
      return;
    }
    const parsed = astroClientConfigInputSchema.safeParse(current);
    if (!parsed.success) {
      setSaveState("invalid");
      return;
    }
    saveInFlightRef.current = true;
    inFlightPayloadRef.current = JSON.stringify(parsed.data);
    saveMutation.mutate({ clientId: targetClientId, config: parsed.data });
  };

  useEffect(() => {
    if (!dirtyRef.current || saveState !== "pending") return;
    const timer = window.setTimeout(() => saveNow(), 850);
    return () => window.clearTimeout(timer);
  }, [config, saveState]);

  const changeConfig = (next: AstroClientConfigInput) => {
    setConfig(next);
    configRef.current = next;
    dirtyRef.current = true;
    setSaveState("pending");
  };

  const applySlotAsset = (
    slot: string,
    asset: { slot: string; storageUrl: string; filename: string; byteSize: number; mediaItemId?: number | null; alt?: string; description?: string } | null,
  ) => {
    setAssets(currentAssets => (
      asset
        ? [...currentAssets.filter(entry => entry.slot !== slot), asset]
        : currentAssets.filter(entry => entry.slot !== slot)
    ));
    const categoryBySlot = {
      categoryHotTubs: "hot-tubs",
      categorySwimSpas: "swim-spas",
      categorySaunas: "saunas",
      categoryColdPlunge: "cold-plunge",
      categoryMassageChairs: "massage-chairs",
    } as const;
    const category = slot in categoryBySlot
      ? categoryBySlot[slot as keyof typeof categoryBySlot]
      : undefined;
    const current = configRef.current;
    if (!current || !category) return;
    const next = {
      ...current,
      categories: {
        ...current.categories,
        [category]: {
          ...current.categories[category],
          heroImage: asset?.storageUrl ?? "",
        },
      },
    };
    setConfig(next);
    configRef.current = next;
    dirtyRef.current = true;
    setSaveState("pending");
  };

  const uploadFile = async (
    slot: AstroAssetSlot,
    file: File,
    options?: { quiet?: boolean },
  ): Promise<AssetUploadResult> => {
    if (uploadInFlightRef.current) {
      return { ok: false, message: "Another upload is already running." };
    }
    const rejection = imageUploadRejectionMessage(file);
    if (rejection) {
      if (!options?.quiet) toast.error(rejection);
      return { ok: false, message: rejection };
    }
    try {
      uploadInFlightRef.current = true;
      setUploadingSlot(slot);
      const completed = await uploadAssetDirectly(
        file,
        { clientId, assetKind: "astro", slot },
        {
          requestUpload: input => requestUploadMutation.mutateAsync({
            clientId: input.clientId,
            assetKind: "astro",
            slot,
            originalFilename: input.originalFilename,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          }),
          completeUpload: input => completeUploadMutation.mutateAsync(input),
          fetchFn: (input, init) => fetch(input, init),
        },
      );
      if (completed.asset) {
        applySlotAsset(slot, {
          slot,
          storageUrl: completed.asset.storageUrl,
          filename: completed.asset.filename,
          byteSize: completed.asset.byteSize,
          mediaItemId: completed.asset.mediaItemId ?? completed.mediaItem.id,
          alt: completed.mediaItem.alt,
          description: completed.mediaItem.description,
        });
      }
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.astroConfig.get.invalidate(queryInput),
        utils.assets.listLibrary.invalidate(queryInput),
      ]);
      if (!options?.quiet) toast.success("Image added.");
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "That image could not be uploaded.";
      if (!options?.quiet) toast.error(message);
      return { ok: false, message };
    } finally {
      uploadInFlightRef.current = false;
      setUploadingSlot(null);
    }
  };

  if (query.error) return <div className="launchpad-panel rounded-lg p-8 text-center"><AlertCircle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Website configuration could not be loaded</p><p className="mt-1 text-xs text-muted-foreground">{query.error.message}</p><Button type="button" variant="outline" size="sm" className="mt-4 h-8 text-xs font-semibold" onClick={() => void query.refetch()}>Try again</Button></div>;
  if (query.isLoading || !config || !secretStatus || !readiness) return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /><p className="mt-3 text-xs text-muted-foreground">Opening client configuration…</p></div></div>;

  return <div className="space-y-3 pb-4">
    {saveState === "error" ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 text-xs font-semibold text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Save failed
        </span>
        <Button type="button" size="sm" onClick={() => saveNow()} disabled={saveMutation.isPending} className="h-9 gap-1.5 text-xs font-semibold">
          <Save className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      </div>
    ) : null}

    <Tabs value={activeTab} onValueChange={tab => selectTab(tab as ConfigTabId)} className="gap-3">
      <ReadinessStrip readiness={readiness} active={activeTab} onSelect={selectTab} />
      <TabsContent value="basic"><BasicInfoTab value={config} readiness={readiness} onChange={changeConfig} /></TabsContent>
      <TabsContent value="branding"><BrandingTab value={config} readiness={readiness} onChange={changeConfig} /></TabsContent>
      <TabsContent value="media"><MediaTab clientId={clientId} value={config} assets={assets} uploadingSlot={uploadingSlot} onUpload={uploadFile} onSlotAssetChange={applySlotAsset} /></TabsContent>
      <TabsContent value="content"><ContentTab value={config} readiness={readiness} onChange={changeConfig} assets={assets} mediaItems={libraryQuery.data?.items ?? []} /></TabsContent>
      <TabsContent value="technical"><TechnicalTab value={config} readiness={readiness} onChange={changeConfig} secretStatus={secretStatus} onOpenClientIntegrations={() => setLocation(`/workspace/${clientId}/integrations`)} /></TabsContent>
    </Tabs>
  </div>;
}
