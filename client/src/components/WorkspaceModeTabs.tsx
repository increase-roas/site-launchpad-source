import { cn } from "@/lib/utils";
import { PanelsTopLeft, Route } from "lucide-react";
import { useLocation } from "wouter";

export function WorkspaceModeTabs({
  clientId,
  active,
}: {
  clientId: number;
  active: "website" | "paidAds";
}) {
  const [, setLocation] = useLocation();
  const options = [
    { key: "website" as const, label: "Website", icon: PanelsTopLeft, path: "pages" },
    { key: "paidAds" as const, label: "Paid Ads", icon: Route, path: "funnels" },
  ];

  return (
    <div className="inline-flex w-full rounded-2xl border border-white/8 bg-black/20 p-1.5 sm:w-auto">
      {options.map(option => {
        const selected = option.key === active;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => setLocation(`/workspace/${clientId}/${option.path}`)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold sm:min-w-36",
              selected
                ? "bg-cyan-400 text-slate-950 shadow-[0_8px_20px_rgba(34,211,238,0.18)]"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            <option.icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
