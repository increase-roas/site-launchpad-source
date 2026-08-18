import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inspectPaidFunnelZipIntake, type PaidAdsFunnelTab, type ZipIntakeResult } from "@shared/paidFunnel";
import { GENERIC_PAID_FUNNEL_FIXTURE_KEY } from "@shared/paidFunnel/fixture";
import { PAID_ADS_SECTION_PRESET_LABELS } from "@shared/paidFunnel/presets";
import { FileArchive, Layers3, Loader2, Upload } from "lucide-react";
import { useState } from "react";

export function PaidAdsFunnelLibrary({
  tab,
  onTabChange,
  onCreateFromFixture,
  onOpenBuilder,
  creating,
}: {
  tab: PaidAdsFunnelTab;
  onTabChange: (tab: PaidAdsFunnelTab) => void;
  onCreateFromFixture: () => void;
  onOpenBuilder: (key: string) => void;
  creating: boolean;
}) {
  const [intake, setIntake] = useState<ZipIntakeResult | null>(null);

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-2xl border border-white/8 bg-black/20 p-1.5">
        {([
          ["templates", "Templates"],
          ["mine", "My Funnels"],
        ] as const).map(([key, label]) => (
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
          <Card className="border-white/8 bg-card/70 p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Paid Ads template</p>
            <h3 className="mt-2 text-xl font-extrabold">Generic multi-step paid funnel</h3>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Landing → Form → Thank You → Booking → Upsell. Visual graph, not a website page list.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.values(PAID_ADS_SECTION_PRESET_LABELS).slice(0, 6).map(label => (
                <span key={label} className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold">{label}</span>
              ))}
            </div>
            <Button
              type="button"
              disabled={creating}
              onClick={onCreateFromFixture}
              className="mt-5 h-12 w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
            >
              {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Layers3 className="h-5 w-5" />}
              Create from paid-funnel fixture
            </Button>
          </Card>

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
                  setIntake(inspectPaidFunnelZipIntake({
                    archiveName: file.name,
                    byteSize: file.size,
                    files: [{ path: file.name, byteSize: file.size }],
                  }));
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
      ) : (
        <Card className="border-white/8 bg-card/70 p-5">
          <h3 className="text-xl font-extrabold">Open a visual paid funnel</h3>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Simple Form stays on its specialized editor. Generic paid funnels open the GHL-style builder.
          </p>
          <Button
            type="button"
            onClick={() => onOpenBuilder(GENERIC_PAID_FUNNEL_FIXTURE_KEY)}
            className="mt-5 h-12 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            Open fixture builder
          </Button>
        </Card>
      )}
    </div>
  );
}
