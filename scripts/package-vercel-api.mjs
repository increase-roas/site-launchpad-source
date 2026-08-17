import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile =
  process.env.VERCEL_API_HANDLER_OUTFILE ??
  path.join(root, "dist/vercel-api-handler.js");

await mkdir(path.dirname(outfile), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "server/_core/vercelApiHandler.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  outfile,
  logLevel: "silent",
});
