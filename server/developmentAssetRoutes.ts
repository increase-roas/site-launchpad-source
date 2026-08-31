import express, { Router, type Request } from "express";
import { MAX_RAW_UPLOAD_BYTES } from "../shared/assetUpload";
import {
  DEFAULT_LOCAL_ASSET_URL_PREFIX,
  type LocalAssetStore,
} from "./localAssetStore";

/** Express 4 exposes a trailing `*` match as the positional parameter "0". */
function wildcardKey(request: Request): string {
  return (request.params as Record<string, string | undefined>)["0"] ?? "";
}

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Permanent keys carry a content hash and a version, so a changed image always
 * arrives under a new URL and the old one can be cached forever. Staging keys
 * under `tmp/` are reused within a single upload and must never be cached.
 */
function cacheControlFor(key: string): string {
  return key.startsWith("tmp/") ? "no-store" : IMMUTABLE_CACHE_CONTROL;
}

/**
 * Serves the local development asset store: signed PUTs stand in for R2
 * presigned uploads, and GETs stand in for the public asset CDN.
 */
export function createDevelopmentAssetRoutes(local: LocalAssetStore): Router {
  const router = Router();
  const pattern = `${DEFAULT_LOCAL_ASSET_URL_PREFIX}/*`;

  router.put(
    pattern,
    express.raw({ type: () => true, limit: MAX_RAW_UPLOAD_BYTES }),
    async (request, response) => {
      const key = wildcardKey(request);
      const expiresAt = Number(request.query.expires);
      const token = typeof request.query.token === "string" ? request.query.token : "";
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);

      const stored = await local.writeUploadedObject(key, expiresAt, token, body);
      if (!stored) {
        response.status(403).json({ error: "Invalid or expired upload token." });
        return;
      }
      response.status(200).json({ ok: true });
    },
  );

  router.get(pattern, async (request, response) => {
    const key = wildcardKey(request);
    const asset = await local.readObjectForServing(key);
    if (!asset) {
      response.status(404).json({ error: "Not Found" });
      return;
    }
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Cache-Control", cacheControlFor(key));
    response.send(asset.body);
  });

  return router;
}
