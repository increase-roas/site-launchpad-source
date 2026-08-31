import { useEffect } from "react";
import { fontPreviewStylesheetHref } from "./fontCatalog";

const PREVIEW_STYLESHEET_ID = "astro-font-previews";

/**
 * Attaches the preview stylesheet the first time any font UI mounts. Loading it
 * on demand rather than in `index.html` keeps `fontCatalog` the only place the
 * approved families are listed, and keeps the faces off the initial page load.
 */
export function useFontPreviews(): void {
  useEffect(() => {
    if (document.getElementById(PREVIEW_STYLESHEET_ID)) return;
    const link = document.createElement("link");
    link.id = PREVIEW_STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = fontPreviewStylesheetHref();
    document.head.appendChild(link);
  }, []);
}
