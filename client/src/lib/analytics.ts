type AnalyticsEnvironment = {
  VITE_ANALYTICS_ENDPOINT?: string;
  VITE_ANALYTICS_WEBSITE_ID?: string;
};

export type AnalyticsScriptConfig = {
  src: string;
  websiteId: string;
};

export function getAnalyticsScriptConfig(
  environment: AnalyticsEnvironment
): AnalyticsScriptConfig | null {
  const endpoint = environment.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = environment.VITE_ANALYTICS_WEBSITE_ID?.trim();
  if (!endpoint || !websiteId) return null;

  try {
    const baseUrl = new URL(endpoint);
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:")
      return null;
    return {
      src: new URL(
        "umami",
        `${baseUrl.toString().replace(/\/$/, "")}/`
      ).toString(),
      websiteId,
    };
  } catch {
    return null;
  }
}

export function installAnalytics(
  document: Document,
  environment: AnalyticsEnvironment
): void {
  const config = getAnalyticsScriptConfig(environment);
  if (!config || document.querySelector("script[data-launchpad-analytics]"))
    return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = config.src;
  script.dataset.websiteId = config.websiteId;
  script.dataset.launchpadAnalytics = "true";
  document.head.appendChild(script);
}
