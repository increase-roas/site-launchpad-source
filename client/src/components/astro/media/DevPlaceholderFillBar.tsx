import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import type { PlaceholderFillProgress } from "./useDevPlaceholderFill";

export function DevPlaceholderFillBar({
  progress,
  missingCount,
  autoRunEnabled,
  onToggleAutoRun,
  onStart,
}: {
  progress: PlaceholderFillProgress;
  missingCount: number;
  autoRunEnabled: boolean;
  onToggleAutoRun: (enabled: boolean) => void;
  onStart: () => void;
}) {
  const status = progress.running
    ? `Generating ${progress.done + 1} of ${progress.total}…`
    : progress.total > 0
      ? `Filled ${progress.done} of ${progress.total}${progress.failed > 0 ? ` · ${progress.failed} failed` : ""}`
      : missingCount > 0
        ? `${missingCount} empty ${missingCount === 1 ? "slot" : "slots"}`
        : "Every slot has an image";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-2">
      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        Dev
      </span>
      <p className="text-xs text-muted-foreground">
        Generated placeholder images · {status}
        {progress.error ? (
          <span className="ml-1 font-semibold text-destructive">{progress.error}</span>
        ) : null}
      </p>

      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={autoRunEnabled}
          onChange={event => onToggleAutoRun(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--primary)]"
        />
        Auto-fill on open
      </label>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={progress.running || missingCount === 0}
        onClick={onStart}
        className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
      >
        {progress.running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Auto-fill images
      </Button>
    </div>
  );
}
