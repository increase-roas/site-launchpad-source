const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function requireHttpsHostname(siteUrl: string): string {
  let url: URL;
  try {
    url = new URL(siteUrl.trim());
  } catch {
    throw new Error("Set a HTTPS Site URL before attaching the live domain.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Site URL must start with https:// before it can go live.");
  }
  return url.hostname.toLowerCase();
}

export function liveHostnameFromSiteUrl(siteUrl: string): string {
  const hostname = requireHttpsHostname(siteUrl);
  if (hostname.endsWith(".workers.dev") || hostname === "localhost") {
    throw new Error("Site URL must be the real domain, not a preview or workers.dev address.");
  }
  if (!HOSTNAME_PATTERN.test(hostname)) {
    throw new Error("Site URL must be a real domain, such as www.theclient.com.");
  }
  return hostname;
}

export function zoneNameCandidates(hostname: string): string[] {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  const names: string[] = [];
  for (let index = 0; index < labels.length - 1; index += 1) {
    names.push(labels.slice(index).join("."));
  }
  return names;
}

export function isWorkersDevUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().endsWith(".workers.dev");
  } catch {
    return false;
  }
}

export function liveUrlForHostname(hostname: string): string {
  return `https://${hostname}`;
}
