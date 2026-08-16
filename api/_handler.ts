import type { Express, Request, Response } from "express";
import { createApp } from "../server/_core/app";

let appPromise: Promise<Express> | undefined;

function getApp(): Promise<Express> {
  appPromise ??= createApp({ mode: "production", serveClientAssets: false });
  return appPromise;
}

export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  const app = await getApp();
  app(request, response);
}
