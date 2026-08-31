import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { fontStack } from "./fontCatalog";
import { FONT_PAIRINGS, activePairingId, type FontPairing } from "./fontPairings";
import { useFontPreviews } from "./useFontPreviews";

/** Neutral enough to read as body copy on any site, long enough to show rhythm. */
const SAMPLE_LINE = "Handcrafted comfort, installed and supported locally.";

/**
 * Curated pairings as specimen cards. The card anatomy deliberately mirrors the
 * Theme swatches directly above it, so the two brand decisions are scanned the
 * same way: shape first, label second.
 */
export function FontPairingGrid({
  display,
  body,
  onSelect,
}: {
  display: string;
  body: string;
  onSelect: (pairing: FontPairing) => void;
}) {
  useFontPreviews();
  const activeId = activePairingId({ display, body });

  return (
    <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
      {FONT_PAIRINGS.map(pairing => {
        const active = pairing.id === activeId;
        const displayStack = fontStack(pairing.display, "text");
        const bodyStack = fontStack(pairing.body, "text");
        return (
          <button
            key={pairing.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(pairing)}
            className={cn(
              "relative p-3 text-left transition-colors",
              active
                ? "bg-primary/[0.07] shadow-[inset_0_0_0_2px_var(--primary)]"
                : "bg-card hover:bg-muted",
            )}
          >
            {active ? (
              <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-2.5 w-2.5" aria-hidden="true" />
              </span>
            ) : null}

            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-border bg-background text-2xl leading-none"
                style={{ fontFamily: displayStack, fontWeight: 700 }}
              >
                Ag
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {pairing.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {pairing.mood}
                </span>
              </span>
            </span>

            <span
              className="mt-2.5 block text-sm leading-relaxed text-foreground"
              style={{ fontFamily: bodyStack }}
            >
              {SAMPLE_LINE}
            </span>

            <span className="mt-2 block truncate text-xs text-muted-foreground">
              <span style={{ fontFamily: displayStack }}>{pairing.display}</span>
              {" · "}
              <span style={{ fontFamily: bodyStack }}>{pairing.body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
