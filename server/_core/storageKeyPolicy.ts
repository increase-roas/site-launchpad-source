const CLIENT_OBJECT_KEY = /^clients\/(\d+)-([^/]+)\/(.+)$/;

export function parseStorageKey(key: string): { clientId: number; folder: string; rest: string } {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("//")) {
    throw new Error("Invalid storage key");
  }
  const match = CLIENT_OBJECT_KEY.exec(normalized);
  if (!match) {
    throw new Error("Invalid storage key");
  }
  return {
    clientId: Number(match[1]),
    folder: match[2],
    rest: match[3],
  };
}

export function isAllowedRedirectUrl(url: string, allowedHostSuffixes: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  return allowedHostSuffixes.some(suffix => {
    const host = suffix.toLowerCase();
    return hostname === host || hostname.endsWith(`.${host}`);
  });
}

export function redirectHostsFromForgeUrl(forgeApiUrl: string): string[] {
  const hosts = ["amazonaws.com", "cloudflarestorage.com", "r2.cloudflarestorage.com"];
  try {
    const forgeHost = new URL(forgeApiUrl).hostname.toLowerCase();
    if (forgeHost) hosts.push(forgeHost);
  } catch {
    // Ignore malformed forge URLs; callers still have the default suffixes.
  }
  return hosts;
}
