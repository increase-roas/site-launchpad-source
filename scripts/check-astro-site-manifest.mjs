import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendoredManifestPath = path.join(
  repoRoot,
  "server/templates/astro-site/launchpad.template.json",
);
const configuredCanonicalRoot = process.env.ASTRO_SITE_CANONICAL_REPOSITORY;
const localCanonicalRoot = configuredCanonicalRoot
  ? path.resolve(configuredCanonicalRoot)
  : path.resolve(repoRoot, "../32-htl-website-template-astrobuild");
const localCanonicalManifestPath = path.join(
  localCanonicalRoot,
  "launchpad.template.json",
);
const publicCanonicalUrl =
  "https://raw.githubusercontent.com/increaseroasir/32-htl-website-template-astrobuild/main/launchpad.template.json";

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readCanonicalManifest() {
  if (await fileExists(localCanonicalManifestPath)) {
    return {
      manifest: await readJsonFile(localCanonicalManifestPath),
      source: localCanonicalManifestPath,
    };
  }

  const response = await fetch(publicCanonicalUrl, {
    headers: { accept: "application/vnd.github.raw+json" },
  });
  if (!response.ok) {
    throw new Error(
      `Could not read the public canonical Astro website manifest (${response.status} ${response.statusText}).`,
    );
  }
  return { manifest: await response.json(), source: publicCanonicalUrl };
}

const vendoredManifest = await readJsonFile(vendoredManifestPath);
const canonical = await readCanonicalManifest();

if (!isDeepStrictEqual(vendoredManifest, canonical.manifest)) {
  throw new Error(
    [
      "Astro website manifest contract drift detected.",
      `Vendored: ${vendoredManifestPath}`,
      `Canonical: ${canonical.source}`,
      `- vendored=${JSON.stringify(vendoredManifest)}`,
      `- canonical=${JSON.stringify(canonical.manifest)}`,
    ].join("\n"),
  );
}

console.log(
  `Astro website manifest contract check passed (canonical: ${canonical.source}).`,
);
