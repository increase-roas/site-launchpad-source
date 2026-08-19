import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_"],
  envDir: repoRoot,
  root: path.resolve(import.meta.dirname, "standalone"),
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "client", "src"),
      "@shared": path.resolve(repoRoot, "shared"),
    },
  },
  server: {
    host: true,
    port: 5174,
    fs: {
      allow: [repoRoot],
    },
  },
});
