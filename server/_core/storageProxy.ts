import type { Request, Response } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { isAllowedRedirectUrl, parseStorageKey, redirectHostsFromForgeUrl } from "./storageKeyPolicy";

type StorageProxyDeps = {
  authenticate: (req: Request) => Promise<unknown>;
  fetchFn: typeof fetch;
  forgeApiUrl: string;
  forgeApiKey: string;
};

const defaultDeps = (): StorageProxyDeps => ({
  authenticate: req => sdk.authenticateRequest(req),
  fetchFn: fetch,
  forgeApiUrl: ENV.forgeApiUrl,
  forgeApiKey: ENV.forgeApiKey,
});

function storageKeyFromRequest(req: Request): string {
  const splat = (req.params as Record<string, string | undefined>)[0];
  if (splat) return splat;
  return req.path.replace(/^\/manus-storage\/?/, "");
}

export async function handleStorageProxyGet(
  req: Request,
  res: Response,
  deps: StorageProxyDeps = defaultDeps(),
): Promise<void> {
  const key = storageKeyFromRequest(req);
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  try {
    await deps.authenticate(req);
  } catch {
    res.status(401).send("Authentication required");
    return;
  }

  try {
    parseStorageKey(key);
  } catch {
    res.status(400).send("Invalid storage key");
    return;
  }

  if (!deps.forgeApiUrl || !deps.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }

  try {
    const forgeUrl = new URL("v1/storage/presign/get", deps.forgeApiUrl.replace(/\/+$/, "") + "/");
    forgeUrl.searchParams.set("path", key);

    const forgeResp = await deps.fetchFn(forgeUrl, {
      headers: { Authorization: `Bearer ${deps.forgeApiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
      res.status(502).send("Storage backend error");
      return;
    }

    const { url } = (await forgeResp.json()) as { url: string };
    if (!url) {
      res.status(502).send("Empty signed URL from backend");
      return;
    }

    if (!isAllowedRedirectUrl(url, redirectHostsFromForgeUrl(deps.forgeApiUrl))) {
      console.error("[StorageProxy] refused redirect host", url);
      res.status(502).send("Storage backend error");
      return;
    }

    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage proxy error");
  }
}

export function registerStorageProxy(app: import("express").Express) {
  app.get("/manus-storage/*", (req, res) => {
    void handleStorageProxyGet(req, res);
  });
}
