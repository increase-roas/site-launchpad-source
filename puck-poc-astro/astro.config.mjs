import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export default defineConfig({
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@puck-poc": path.resolve(repoRoot, "client/src/puck-poc"),
      },
    },
    server: {
      fs: {
        allow: [repoRoot],
      },
    },
  },
});
