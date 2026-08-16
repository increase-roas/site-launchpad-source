import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

export const CLIENT_BUILD_DIRECTORY = "dist/public";
export const MISSING_CLIENT_BUILD_MESSAGE =
  "Client build is missing. Run the production build first.";

export function intendedClientAssetDirectory(cwd = process.cwd()): string {
  return path.resolve(cwd, CLIENT_BUILD_DIRECTORY);
}

export function serveStatic(
  app: Express,
  clientAssetDirectory = intendedClientAssetDirectory(),
): void {
  const indexPath = path.resolve(clientAssetDirectory, "index.html");
  if (!fs.existsSync(indexPath)) {
    app.use((_req, res) => {
      res.status(503).json({ error: MISSING_CLIENT_BUILD_MESSAGE });
    });
    return;
  }

  app.use(express.static(clientAssetDirectory));
  app.use("*", (_req, res) => {
    res.sendFile(indexPath);
  });
}
