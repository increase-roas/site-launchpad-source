import { fontStack } from "./fontCatalog";
import { activePairingId, FONT_PAIRINGS } from "./fontPairings";
import { useFontPreviews } from "./useFontPreviews";

const PLACEHOLDER_HEADLINE = "Your business name";
const PLACEHOLDER_TAGLINE = "Your tagline appears here, set in the body font.";

/**
 * The pair judged on real copy rather than on the word "Manrope". Pulling the
 * headline and tagline from the config being edited means the operator sees the
 * sentence that will actually ship.
 */
export function FontSpecimen({
  display,
  body,
  headline,
  tagline,
}: {
  display: string;
  body: string;
  headline: string;
  tagline: string;
}) {
  useFontPreviews();
  const pairingName = FONT_PAIRINGS.find(
    pairing => pairing.id === activePairingId({ display, body }),
  )?.name;

  return (
    <div className="bg-card px-4 py-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Live preview</span>
        <span className="text-xs text-muted-foreground">
          {pairingName ?? "Custom pairing"}
        </span>
      </div>

      <p
        className="mt-3 text-3xl font-bold leading-tight text-foreground"
        style={{ fontFamily: fontStack(display, "text") }}
      >
        {headline.trim() || PLACEHOLDER_HEADLINE}
      </p>
      <p
        className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"
        style={{ fontFamily: fontStack(body, "text") }}
      >
        {tagline.trim() || PLACEHOLDER_TAGLINE}
      </p>
      <span
        className="mt-4 inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        style={{ fontFamily: fontStack(body, "text") }}
      >
        Request a quote
      </span>
    </div>
  );
}
