import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/check-simple-form-manifest.mjs");
const vendoredManifestPath = path.join(
  repoRoot,
  "server/templates/simple-form/launchpad.template.json",
);
const historicalCoreFields = [
  "schemaVersion",
  "contractVersion",
  "templateKey",
  "repo",
  "defaultBranch",
  "type",
  "shape",
  "active",
];

async function withCanonicalManifest(manifest, assertion) {
  const canonicalRoot = await mkdtemp(
    path.join(os.tmpdir(), "simple-form-manifest-"),
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
        SIMPLE_FORM_CANONICAL_REPOSITORY: canonicalRoot,
      },
    });
    assertion(result);
  } finally {
    await rm(canonicalRoot, { recursive: true, force: true });
  }
}

function changedValue(value) {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  return `${value}-drift`;
}

test("preserves exactly the historical eight core comparisons", async () => {
  const vendored = JSON.parse(await readFile(vendoredManifestPath, "utf8"));

  await withCanonicalManifest(
    { ...vendored, name: "Uncompared display-name drift" },
    result => {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /\(8 fields;/);
    },
  );

  for (const field of historicalCoreFields) {
    await withCanonicalManifest(
      { ...vendored, [field]: changedValue(vendored[field]) },
      result => {
        assert.notEqual(result.status, 0, `${field} unexpectedly passed`);
        assert.match(result.stderr, /Simple Form manifest contract drift detected/);
        assert.doesNotMatch(
          result.stderr,
          /offline conversion contract drift detected/,
        );
      },
    );
  }
});

test("reports offline conversion contract drift separately", async () => {
  const vendored = JSON.parse(await readFile(vendoredManifestPath, "utf8"));
  await withCanonicalManifest(
    {
      ...vendored,
      offlineConversionContract: {
        ...vendored.offlineConversionContract,
        joinKey: "leadId",
      },
    },
    result => {
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Simple Form offline conversion contract drift detected/,
      );
    },
  );
});

test("reports a missing offline conversion contract separately", async () => {
  const vendored = JSON.parse(await readFile(vendoredManifestPath, "utf8"));
  const canonical = { ...vendored };
  delete canonical.offlineConversionContract;

  await withCanonicalManifest(canonical, result => {
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Simple Form offline conversion contract drift detected/,
    );
  });
});
