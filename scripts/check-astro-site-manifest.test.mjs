import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/check-astro-site-manifest.mjs");
const vendoredManifestPath = path.join(
  repoRoot,
  "server/templates/astro-site/launchpad.template.json",
);

async function withCanonicalManifest(manifest, assertion) {
  const canonicalRoot = await mkdtemp(
    path.join(os.tmpdir(), "astro-site-manifest-"),
  );
  try {
    await writeFile(
      path.join(canonicalRoot, "launchpad.template.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ASTRO_SITE_CANONICAL_REPOSITORY: canonicalRoot,
      },
    });
    assertion(result);
  } finally {
    await rm(canonicalRoot, { recursive: true, force: true });
  }
}

test("passes only when the full vendored Astro manifest matches", async () => {
  const vendored = JSON.parse(await readFile(vendoredManifestPath, "utf8"));
  await withCanonicalManifest(vendored, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Astro website manifest contract check passed/);
  });
});

test("reports top-level and nested Astro manifest drift", async () => {
  const vendored = JSON.parse(await readFile(vendoredManifestPath, "utf8"));

  await withCanonicalManifest(
    { ...vendored, workflow: "publish.yml" },
    result => {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Astro website manifest contract drift detected/);
    },
  );

  await withCanonicalManifest(
    {
      ...vendored,
      runtimeSecrets: {
        ...vendored.runtimeSecrets,
        conditional: {
          ...vendored.runtimeSecrets.conditional,
          meta: ["META_PIXEL_ID"],
        },
      },
    },
    result => {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Astro website manifest contract drift detected/);
    },
  );
});
