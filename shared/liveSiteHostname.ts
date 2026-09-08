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

const ATTACHED_TO_OTHER_WORKER_PATTERN =
  /^(\S+) is already attached to another Worker/;

export function describeHostnameAttachedToOtherWorker(
  hostname: string,
  otherWorkerName: string,
): string {
  const owner = otherWorkerName.trim() || "another Worker";
  return [
    `${hostname} is already attached to Worker "${owner}".`,
    "Launchpad will not move a live domain off another site until you confirm.",
    "Retry to move it here, or review Site URL if this client should use a different domain.",
  ].join(" ");
}

export function parseHostnameAttachedToOtherWorker(
  error: string | null | undefined,
): { hostname: string; otherWorkerName: string } | null {
  if (!error) return null;
  const named = error.match(
    /^(\S+) is already attached to Worker "([^"]+)"/,
  );
  if (named?.[1] && named[2]) {
    return { hostname: named[1], otherWorkerName: named[2] };
  }
  const legacy = error.match(ATTACHED_TO_OTHER_WORKER_PATTERN);
  if (!legacy?.[1]) return null;
  return { hostname: legacy[1], otherWorkerName: "another Worker" };
}

export function explainPublishDomainError(
  error: string | null | undefined,
): string | null {
  if (!error) return null;
  const conflict = parseHostnameAttachedToOtherWorker(error);
  if (conflict) {
    return describeHostnameAttachedToOtherWorker(
      conflict.hostname,
      conflict.otherWorkerName,
    );
  }
  return error;
}
