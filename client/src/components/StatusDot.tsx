import { cn } from "@/lib/utils";

type StatusDotProps = {
  good: boolean;
  label: string;
  compact?: boolean;
  tone?: "green" | "yellow" | "red";
};

export function StatusDot({ good, label, compact = false, tone }: StatusDotProps) {
  const resolvedTone = tone ?? (good ? "green" : "red");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full font-bold",
        compact ? "text-xs" : "px-3 py-1.5 text-sm",
        resolvedTone === "green"
          ? "text-emerald-300"
          : resolvedTone === "yellow"
            ? "text-amber-300"
            : "text-red-300",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block shrink-0 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.04)]",
          compact ? "h-2.5 w-2.5" : "h-3 w-3",
          resolvedTone === "green"
            ? "bg-emerald-400"
            : resolvedTone === "yellow"
              ? "bg-amber-400"
              : "bg-red-500",
        )}
      />
      <span>{label}</span>
    </span>
  );
}
