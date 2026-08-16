import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { Server } from "node:http";
import { appRouter } from "../routers";
import { createContext } from "./context";
import {
  deriveRuntimeMode,
  type RuntimeMode,
  validateRuntimeEnv,
} from "./env";
import { serveStatic } from "./static";

export type CreateAppOptions = {
  mode?: RuntimeMode;
  developmentServer?: Server;
  serveClientAssets?: boolean;
  clientAssetDirectory?: string;
};

const handleOversizedBody: ErrorRequestHandler = (error, _req, res, next) => {
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  const type =
    error && typeof error === "object" && "type" in error
      ? error.type
      : undefined;
  if (status === 413 || type === "entity.too.large") {
    res.status(413).json({
      error: "Request body is too large. Maximum size is 4 MB.",
    });
    return;
  }
  next(error);
};

export async function createApp(
  options: CreateAppOptions = {},
): Promise<Express> {
  const mode = options.mode ?? deriveRuntimeMode();
  validateRuntimeEnv(mode);

  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ limit: "4mb", extended: true }));
  app.use(handleOversizedBody);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  if (mode === "development") {
    if (!options.developmentServer) {
      throw new Error(
        "A developmentServer is required in development mode.",
      );
    }
    const { setupVite } = await import("./vite");
    await setupVite(app, options.developmentServer);
  } else if (mode === "production" && options.serveClientAssets !== false) {
    serveStatic(app, options.clientAssetDirectory);
  }

  return app;
}
