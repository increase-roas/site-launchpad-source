import { cn } from "@/lib/utils";

type ReadinessBarProps = {
  percent: number;
  completed?: number;
  total?: number;
  size?: "small" | "large";
};

export function ReadinessBar({
  percent,
  completed,
  total,
  size = "small",
}: ReadinessBarProps) {
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">Launch readiness</span>
        <span className="font-extrabold tabular-nums text-foreground">{safePercent}%</span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-white/8",
          size === "large" ? "h-3" : "h-2.5",
        )}
        role="progressbar"
        aria-label="Launch readiness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercent}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            safePercent === 100
              ? "bg-emerald-400"
              : "bg-gradient-to-r from-cyan-500 to-teal-400",
          )}
          style={{ width: `${safePercent}%` }}
        />
      </div>
      {completed !== undefined && total !== undefined ? (
        <p className="text-xs font-medium text-muted-foreground">
          {completed} of {total} items complete
        </p>
      ) : null}
    </div>
  );
}
