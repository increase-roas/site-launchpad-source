import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "./app";

let appPromise: Promise<Express> | undefined;

function getApp(): Promise<Express> {
  appPromise ??= createApp({
    mode: "production",
    serveClientAssets: false,
  }).catch(error => {
    appPromise = undefined;
    throw error;
  });
  return appPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const app = await getApp();
  app(request, response);
}
