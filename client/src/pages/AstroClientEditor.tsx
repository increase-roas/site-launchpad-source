import { BasicInfoTab } from "@/components/astro/BasicInfoTab";
import { BrandingTab } from "@/components/astro/BrandingTab";
import { ContentTab } from "@/components/astro/ContentTab";
import { TechnicalTab } from "@/components/astro/TechnicalTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  astroClientConfigInputSchema,
  type AstroAssetSlot,
  type AstroClientConfigInput,
  type WranglerSecretName,
} from "@shared/astroConfig";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Megaphone, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  saveClientIdForMountedEditor,
  shouldClearDirtyAfterSave,
  shouldHydrateEditor,
} from "./editorIsolation";

type SaveState = "idle" | "pending" | "saving" | "saved" | "invalid" | "error";

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function AstroClientEditor({ clientId }: { clientId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ clientId }), [clientId]);
  const query = trpc.astroConfig.get.useQuery(queryInput);
  const [config, setConfig] = useState<AstroClientConfigInput | null>(null);
  const [assets, setAssets] = useState<Array<{ slot: string; storageUrl: string; filename: string; byteSize: number }>>([]);
  const [generatedConfig, setGeneratedConfig] = useState("");
  const [secretStatus, setSecretStatus] = useState<Record<WranglerSecretName, boolean> | null>(null);
  const [secretDrafts, setSecretDrafts] = useState<Partial<Record<WranglerSecretName, string>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<AstroAssetSlot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [issues, setIssues] = useState<string[]>([]);
  const hydratedForClientIdRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const configRef = useRef<AstroClientConfigInput | null>(null);
  const saveInFlightRef = useRef(false);
  const trailingSaveRef = useRef(false);
  const inFlightPayloadRef = useRef("");
  const mountedClientIdRef = useRef(clientId);
  mountedClientIdRef.current = clientId;
  const initialTab = useMemo(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "branding" || tab === "content" || tab === "technical" ? tab : "basic";
  }, []);

  useEffect(() => {
    if (!query.data || !shouldHydrateEditor(hydratedForClientIdRef.current, clientId)) return;
    setConfig(query.data.input);
    configRef.current = query.data.input;
    setAssets(query.data.assets);
    setGeneratedConfig("");
    setSecretStatus(query.data.secretStatus);
    setSaveState("saved");
    dirtyRef.current = false;
    hydratedForClientIdRef.current = clientId;
  }, [query.data, clientId]);

  const secretMutation = trpc.astroConfig.saveSecrets.useMutation({
    onSuccess: view => {
      setSecretStatus(view.secretStatus);
      setSecretDrafts({});
      toast.success("Protected values saved.");
    },
    onError: error => toast.error(error.message),
  });

  const uploadMutation = trpc.astroConfig.uploadAsset.useMutation({
    onSuccess: view => {
      setAssets(view.assets);
      const current = configRef.current ?? view.input;
      const uploaded = view.assets.find(asset => asset.slot === uploadingSlot);
      const categoryBySlot = {
        categoryHotTubs: "hot-tubs",
        categorySwimSpas: "swim-spas",
        categorySaunas: "saunas",
        categoryColdPlunge: "cold-plunge",
        categoryMassageChairs: "massage-chairs",
      } as const;
      const category = uploadingSlot && uploadingSlot in categoryBySlot
        ? categoryBySlot[uploadingSlot as keyof typeof categoryBySlot]
        : undefined;
      const next = category && uploaded
        ? {
            ...current,
            categories: {
              ...current.categories,
              [category]: { ...current.categories[category], heroImage: uploaded.storageUrl },
            },
          }
        : current;
      setConfig(next);
      configRef.current = next;
      dirtyRef.current = true;
      setSaveState("pending");
      toast.success("Image added.");
    },
    onError: error => toast.error(error.message),
    onSettled: () => setUploadingSlot(null),
  });

  const exportMutation = trpc.astroConfig.exportGeneratedConfig.useMutation();

  const revealGeneratedConfig = async () => {
    const exported = await exportMutation.mutateAsync({ clientId });
    setGeneratedConfig(exported.contents);
    return exported.contents;
  };

  const saveMutation = trpc.astroConfig.save.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: async view => {
      setAssets(view.assets);
      setSecretStatus(view.secretStatus);
      setIssues([]);
      await Promise.all([utils.clients.list.invalidate(), utils.astroConfig.get.invalidate(queryInput)]);
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
    },
    onError: error => {
      saveInFlightRef.current = false;
      trailingSaveRef.current = false;
      setSaveState("error");
      toast.error(error.message);
    },
  });

  const saveNow = (options: { revealConfig?: boolean } = {}) => {
    const current = configRef.current;
    const targetClientId = saveClientIdForMountedEditor(mountedClientIdRef.current, clientId);
    if (!current || targetClientId === null) return;
    if (saveInFlightRef.current || saveMutation.isPending) {
      trailingSaveRef.current = dirtyRef.current;
      return;
    }
    const parsed = astroClientConfigInputSchema.safeParse(current);
    if (!parsed.success) {
      const nextIssues = Array.from(new Set(parsed.error.issues.map(issue => `${issue.path.join(" → ")}: ${issue.message}`))).slice(0, 8);
      setIssues(nextIssues);
      setSaveState("invalid");
      if (options.revealConfig) toast.error("Complete the highlighted setup items before generating the config.");
      return;
    }
    saveInFlightRef.current = true;
    inFlightPayloadRef.current = JSON.stringify(parsed.data);
    saveMutation.mutate({ clientId: targetClientId, config: parsed.data }, {
      onSuccess: async () => {
        if (!options.revealConfig) return;
        try {
          await revealGeneratedConfig();
          toast.success("client.config.ts generated.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Generated config could not be exported.");
        }
      },
    });
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
    setIssues([]);
  };

  const uploadFile = async (slot: AstroAssetSlot, file: File) => {
    if (uploadingSlot) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      toast.error("Choose an image file smaller than 20 MB.");
      return;
    }
    try {
      setUploadingSlot(slot);
      uploadMutation.mutate({ clientId, slot, originalFilename: file.name, dataUrl: await toDataUrl(file) });
    } catch (error) {
      setUploadingSlot(null);
      toast.error(error instanceof Error ? error.message : "That image could not be read.");
    }
  };

  if (query.error) return <div className="mx-auto max-w-xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center"><AlertCircle className="mx-auto h-9 w-9 text-red-300" /><h1 className="mt-4 text-2xl font-extrabold">Configuration could not be opened</h1><p className="mt-2 text-muted-foreground">{query.error.message}</p></div>;
  if (query.isLoading || !config || !secretStatus) return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-300" /><p className="mt-4 font-bold text-muted-foreground">Opening client configuration…</p></div></div>;

  return <div className="mx-auto w-full max-w-[1540px] pb-24 sm:p-2 lg:p-5">
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><Button type="button" variant="ghost" onClick={() => setLocation(`/workspace/${clientId}/pages`)} className="-ml-3 h-11 gap-2 text-base font-bold text-muted-foreground"><ArrowLeft className="h-5 w-5" /> Back to website</Button><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Client configuration</h1><p className="mt-2 max-w-2xl font-medium text-muted-foreground">Everything the Astro template needs, organized into four clear tabs.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-extrabold ${saveState === "invalid" || saveState === "error" ? "border-red-400/20 bg-red-400/[0.06] text-red-200" : "border-white/9 bg-white/[0.025] text-muted-foreground"}`}>{saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === "saved" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : saveState === "invalid" || saveState === "error" ? <AlertCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveState === "saving" ? "Saving…" : saveState === "pending" ? "Changes waiting" : saveState === "invalid" ? "Needs attention" : saveState === "error" ? "Save failed" : "Saved"}</span><Button type="button" variant="outline" onClick={() => setLocation(`/workspace/${clientId}/funnels`)}><Megaphone className="h-4 w-4" /> Paid Ads</Button><Button type="button" onClick={() => saveNow()} disabled={saveMutation.isPending} className="bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"><Save className="h-4 w-4" /> Save now</Button></div>
    </header>

    {issues.length ? <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4"><p className="font-extrabold text-red-200">Complete these items to save:</p><ul className="mt-2 space-y-1 text-sm font-medium text-red-100/80">{issues.map(issue => <li key={issue}>• {issue}</li>)}</ul></div> : null}

    <Tabs defaultValue={initialTab} onValueChange={tab => window.history.replaceState({}, "", `${window.location.pathname}?tab=${tab}`)} className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-white/8 bg-card/80 p-1.5 sm:grid-cols-4"><TabsTrigger value="basic" className="min-h-12 text-sm font-extrabold">Basic Info</TabsTrigger><TabsTrigger value="branding" className="min-h-12 text-sm font-extrabold">Branding</TabsTrigger><TabsTrigger value="content" className="min-h-12 text-sm font-extrabold">Content</TabsTrigger><TabsTrigger value="technical" className="min-h-12 text-sm font-extrabold">Technical</TabsTrigger></TabsList>
      <TabsContent value="basic"><BasicInfoTab value={config} onChange={changeConfig} /></TabsContent>
      <TabsContent value="branding"><BrandingTab value={config} onChange={changeConfig} assets={assets} uploadingSlot={uploadingSlot} onUpload={uploadFile} /></TabsContent>
      <TabsContent value="content"><ContentTab value={config} onChange={changeConfig} assets={assets} uploadingSlot={uploadingSlot} onUpload={uploadFile} /></TabsContent>
      <TabsContent value="technical"><TechnicalTab value={config} onChange={changeConfig} secretStatus={secretStatus} secretDrafts={secretDrafts} onSecretChange={(name, value) => setSecretDrafts(current => ({ ...current, [name]: value }))} onSaveSecrets={() => secretMutation.mutate({ clientId, values: secretDrafts })} savingSecrets={secretMutation.isPending} generatedConfig={generatedConfig} onGenerate={() => saveNow({ revealConfig: true })} generating={saveMutation.isPending || exportMutation.isPending} onRevealConfig={revealGeneratedConfig} revealing={exportMutation.isPending} /></TabsContent>
    </Tabs>
  </div>;
}
