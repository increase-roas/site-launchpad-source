import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ASTRO_INTEGRATION_FIELDS,
  ASTRO_INTEGRATION_VALUES,
  type AstroClientConfigInput,
  type AstroIntegration,
  type WranglerSecretName,
} from "@shared/astroConfig";
import { summarizeRuntimeConfiguration } from "@shared/operationalSummary";
import { Check, Clipboard, CloudCog, Code2, Download, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INTEGRATION_LABELS: Record<AstroIntegration, string> = {
  d1: "Cloudflare D1",
  r2: "Cloudflare R2",
  ghl: "GoHighLevel",
  meta: "Meta",
  zaraz: "Cloudflare Zaraz",
  sentry: "Sentry",
};

export function TechnicalTab({
  value,
  onChange,
  secretStatus,
  onOpenClientIntegrations,
  generatedConfig,
  onGenerate,
  generating,
  onRevealConfig,
  revealing,
}: {
  value: AstroClientConfigInput;
  onChange: (next: AstroClientConfigInput) => void;
  secretStatus: Record<WranglerSecretName, boolean>;
  onOpenClientIntegrations: () => void;
  generatedConfig: string;
  onGenerate: () => void;
  generating: boolean;
  onRevealConfig: () => Promise<string>;
  revealing: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const updateIntegration = (name: AstroIntegration, patch: Partial<AstroClientConfigInput["integrations"][AstroIntegration]>) => onChange({ ...value, integrations: { ...value.integrations, [name]: { ...value.integrations[name], ...patch } } });

  const copyConfig = async () => {
    const contents = generatedConfig || (await onRevealConfig());
    await navigator.clipboard.writeText(contents);
    setCopied(true);
    toast.success("Config copied.");
    window.setTimeout(() => setCopied(false), 1600);
  };
  const downloadConfig = async () => {
    const contents = generatedConfig || (await onRevealConfig());
    const blob = new Blob([contents], { type: "text/typescript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "client.config.ts";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-5">
    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="mb-6 flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><CloudCog className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Integrations</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Turn on only the services this site uses. Setup fields appear automatically.</p></div></div>
      <div className="grid gap-4 lg:grid-cols-2">{ASTRO_INTEGRATION_VALUES.map(name => { const integration = value.integrations[name]; const integrationConfig = integration.config as Record<string, string>; const fields = Object.entries(ASTRO_INTEGRATION_FIELDS[name]); return <div key={name} className="rounded-2xl border border-white/8 bg-white/[0.018] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold">{INTEGRATION_LABELS[name]}</h3><p className="mt-1 text-sm font-medium text-muted-foreground">{integration.enabled ? "Enabled" : "Not used"}</p></div><Switch checked={integration.enabled} onCheckedChange={enabled => updateIntegration(name, { enabled })} /></div>{integration.enabled && fields.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="block space-y-2"><span className="text-sm font-extrabold">{label}</span><Input value={integrationConfig[key] ?? ""} onChange={event => updateIntegration(name, { config: { ...integrationConfig, [key]: event.target.value } })} /></label>)}</div> : integration.enabled ? <p className="mt-4 text-sm font-medium text-muted-foreground">Client identifiers and protected values are managed once in Client integrations below.</p> : null}</div>; })}</div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><KeyRound className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Client integrations</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Enter these values once at the client level. The website and every funnel reuse the same protected profile.</p><p className="mt-2 text-xs font-extrabold text-cyan-200">{summarizeRuntimeConfiguration(secretStatus).label}</p></div></div><Button type="button" onClick={onOpenClientIntegrations} className="h-11 bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300">Open client integrations</Button></div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Code2 className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">Config export</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Generate a complete, formatted file ready for the Astro template.</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={onGenerate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />} Generate</Button><Button type="button" variant="outline" onClick={() => void copyConfig()} disabled={generating || revealing}>{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />} Copy</Button><Button type="button" variant="outline" onClick={() => void downloadConfig()} disabled={generating || revealing}><Download className="h-4 w-4" /> Download</Button></div></div>
      <pre className="max-h-[560px] overflow-auto rounded-2xl border border-white/8 bg-black/35 p-4 text-xs leading-relaxed text-cyan-100"><code>{generatedConfig || "Save the client configuration to generate client.config.ts."}</code></pre>
    </Card>
  </div>;
}
