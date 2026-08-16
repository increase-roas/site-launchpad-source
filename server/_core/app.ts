import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type Express } from "express";
import type { Server } from "node:http";
import { appRouter } from "../routers";
import { createContext } from "./context";
import {
  deriveRuntimeMode,
  type RuntimeMode,
  validateRuntimeEnv,
} from "./env";
import { serveStatic } from "./static";
import { registerStorageProxy } from "./storageProxy";

export type CreateAppOptions = {
  mode?: RuntimeMode;
  developmentServer?: Server;
};

export async function createApp(
  options: CreateAppOptions = {},
): Promise<Express> {
  const mode = options.mode ?? deriveRuntimeMode();
  validateRuntimeEnv(mode);

  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
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
  } else if (mode === "production") {
    serveStatic(app);
  }

  return app;
}
