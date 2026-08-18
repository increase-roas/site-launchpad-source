import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inspectPaidFunnelZipIntake, type PaidAdsFunnelTab, type ZipIntakeResult } from "@shared/paidFunnel";
import { FileArchive, Layers3, Loader2, Route, Upload } from "lucide-react";
import { useState } from "react";

export type LibraryTemplate = {
  templateKey: string;
  name: string;
  framework?: string;
  stepCount?: number;
  source?: string;
  status?: string;
  existingFunnelId?: number | null;
};

export type LibraryFunnel = {
  id: number;
  name: string;
  slug: string;
  source: string;
  status: string;
  updatedAt?: string | Date;
};

export function PaidAdsFunnelLibrary({
  tab,
  onTabChange,
  onCreateFromTemplate,
  onOpenFunnel,
  creating,
  templates,
  templatesLoading,
  funnels,
  funnelsLoading,
}: {
  tab: PaidAdsFunnelTab;
  onTabChange: (tab: PaidAdsFunnelTab) => void;
  onCreateFromTemplate: (templateKey: string) => void;
  onOpenFunnel: (funnelId: number) => void;
  creating: boolean;
  templates: LibraryTemplate[];
  templatesLoading: boolean;
  funnels: LibraryFunnel[];
  funnelsLoading: boolean;
}) {
  const [intake, setIntake] = useState<ZipIntakeResult | null>(null);

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-2xl border border-white/8 bg-black/20 p-1.5">
        {(
          [
            ["templates", "Templates"],
            ["mine", "My Funnels"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={`h-11 rounded-xl px-5 text-sm font-extrabold ${
              tab === key ? "bg-cyan-400 text-slate-950" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {templatesLoading ? (
            <Card className="border-white/8 bg-card/70 p-8 text-center font-bold text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
              Loading registry templates…
            </Card>
          ) : templates.length ? (
            templates.map(template => (
              <Card key={template.templateKey} className="border-white/8 bg-card/70 p-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                  {template.source === "zip" ? "Imported template" : "Paid Ads template"}
                </p>
                <h3 className="mt-2 text-xl font-extrabold">{template.name}</h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {template.stepCount ?? "?"} steps · {template.framework ?? "unknown"} · {template.status ?? "ready"}
                </p>
                <Button
                  type="button"
                  disabled={creating}
                  onClick={() => onCreateFromTemplate(template.templateKey)}
                  className="mt-5 h-12 w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
                >
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Layers3 className="h-5 w-5" />}
                  {template.existingFunnelId ? "Open existing from template" : "Create from template"}
                </Button>
              </Card>
            ))
          ) : (
            <Card className="border-white/8 bg-card/70 p-5 font-bold text-muted-foreground">
              No paid-funnel templates in the registry yet.
            </Card>
          )}

          <Card className="border-dashed border-cyan-300/25 bg-cyan-400/[0.04] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <FileArchive className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Import</p>
                <h3 className="text-xl font-extrabold">ZIP dropzone</h3>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Intake only. Prefer launchpad.template.json. Rejects traversal, secrets, executables, and oversized archives.
            </p>
            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-sm font-bold text-muted-foreground">
              <Upload className="mb-2 h-5 w-5 text-cyan-300" />
              Drop a paid-funnel .zip here
              <input
                type="file"
                accept=".zip"
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setIntake(
                    inspectPaidFunnelZipIntake({
                      archiveName: file.name,
                      byteSize: file.size,
                      files: [{ path: file.name, byteSize: file.size }],
                    }),
                  );
                }}
              />
            </label>
            {intake ? (
              <p className="mt-3 text-sm font-bold text-cyan-200">
                {intake.status}: {intake.errors[0] ?? "Ready for registry ingest."}
              </p>
            ) : null}
          </Card>
        </div>
      ) : funnelsLoading ? (
        <Card className="border-white/8 bg-card/70 p-8 text-center font-bold text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
          Loading my funnels…
        </Card>
      ) : funnels.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {funnels.map(funnel => (
            <Card key={funnel.id} className="border-white/8 bg-card/70 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold">{funnel.name}</h3>
                  <p className="mt-1 text-sm font-bold text-cyan-300">/{funnel.slug}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {funnel.source} · {funnel.status}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => onOpenFunnel(funnel.id)}
                className="mt-5 h-12 w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
              >
                Open visual builder
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-white/8 bg-card/70 p-5">
          <h3 className="text-xl font-extrabold">No registry funnels yet</h3>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Create one from a paid-funnel template. Simple Form stays on its specialized editor below.
          </p>
        </Card>
      )}
    </div>
  );
}
