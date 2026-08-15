import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const comparedFields = [
  "schemaVersion",
  "contractVersion",
  "templateKey",
  "repo",
  "defaultBranch",
  "type",
  "shape",
  "active",
];
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const vendoredManifestPath = path.join(
  repoRoot,
  "server/templates/simple-form/launchpad.template.json"
);
const configuredCanonicalRoot = process.env.SIMPLE_FORM_CANONICAL_REPOSITORY;
const localCanonicalRoot = configuredCanonicalRoot
  ? path.resolve(configuredCanonicalRoot)
  : path.resolve(repoRoot, "../paid-funnel-simple-form-funnel");
const localCanonicalManifestPath = path.join(
  localCanonicalRoot,
  "launchpad.template.json"
);
const publicCanonicalUrl =
  "https://raw.githubusercontent.com/increase-roas/paid-funnel-simple-form-funnel/main/launchpad.template.json";

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
      `Could not read the public canonical manifest (${response.status} ${response.statusText}).`
    );
  }
  return {
    manifest: await response.json(),
    source: publicCanonicalUrl,
  };
}

const vendoredManifest = await readJsonFile(vendoredManifestPath);
const canonical = await readCanonicalManifest();
const drift = comparedFields.flatMap(field =>
  Object.is(vendoredManifest[field], canonical.manifest[field])
    ? []
    : [
        `${field}: vendored=${JSON.stringify(vendoredManifest[field])} canonical=${JSON.stringify(canonical.manifest[field])}`,
      ]
);

if (drift.length > 0) {
  throw new Error(
    [
      "Simple Form manifest contract drift detected.",
      `Vendored: ${vendoredManifestPath}`,
      `Canonical: ${canonical.source}`,
      ...drift.map(item => `- ${item}`),
    ].join("\n")
  );
}

console.log(
  `Simple Form manifest contract check passed (${comparedFields.length} fields; canonical: ${canonical.source}).`
);
