import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ASSET_SLOT_LABELS, ASSET_SLOT_VALUES } from "@shared/client";
import { ImageIcon, Loader2, Settings } from "lucide-react";
import { useLocation } from "wouter";

export default function MediaWorkspace({ clientId }: { clientId: number }) {
  const [, setLocation] = useLocation();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });

  if (workspaceQuery.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>;
  }

  if (!workspaceQuery.data) {
    return <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center font-extrabold">Media could not be loaded.</div>;
  }

  const workspace = workspaceQuery.data;
  const assetMap = new Map(workspace.assets.map(asset => [asset.slot, asset]));

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-card/75 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Media</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{workspace.client.businessName} photos</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">Logo and marketing photos used across the website.</p>
        </div>
        <Button type="button" onClick={() => setLocation(`/workspace/${clientId}/settings`)} className="h-12 gap-2 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300">
          <Settings className="h-4 w-4" />
          Manage uploads
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ASSET_SLOT_VALUES.map(slot => {
          const asset = assetMap.get(slot);
          return (
            <div key={slot} className="overflow-hidden rounded-2xl border border-white/8 bg-card/70">
              {asset ? (
                <img src={asset.storageUrl} alt={`${ASSET_SLOT_LABELS[slot]} preview`} className="aspect-[16/10] w-full object-cover" />
              ) : (
                <div className="grid aspect-[16/10] place-items-center bg-black/20">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-bold text-muted-foreground">No photo added</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-white/8 p-4">
                <h2 className="font-extrabold">{ASSET_SLOT_LABELS[slot]}</h2>
                <StatusDot good={Boolean(asset)} label={asset ? "Added" : "Missing"} compact />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
