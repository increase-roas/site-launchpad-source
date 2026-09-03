import { ASTRO_SITE_MANIFEST } from "../../shared/astroSiteContract";
import {
  renderAstroSiteWranglerToml,
  type AstroSiteWranglerConfigInput,
} from "./astroSiteWranglerConfig";
import { patchAstroSiteWorkerRuntimeFiles } from "./astroSiteWorkerRuntimePatch";
import type { GitHubApiClient } from "./githubApi";

export function astroSiteSessionKvTitle(workerName: string): string {
  return `${workerName}-session`;
}

export async function commitAstroSiteGeneratedSource(input: {
  github: Pick<GitHubApiClient, "getFileText" | "findCommitByMessage" | "commitFiles">;
  owner: string;
  repository: string;
  branch: string;
  message: string;
  generatedConfig: string;
  wrangler: AstroSiteWranglerConfigInput;
  signal: AbortSignal;
}): Promise<{ commitSha: string }> {
  const existing = await input.github.findCommitByMessage({
    owner: input.owner,
    repository: input.repository,
    branch: input.branch,
    message: input.message,
    signal: input.signal,
  });
  if (existing) return existing;

  const schemaTs = await input.github.getFileText({
    owner: input.owner,
    repository: input.repository,
    path: "src/config/schema.ts",
    ref: input.branch,
    signal: input.signal,
  });
  const indexTs = await input.github.getFileText({
    owner: input.owner,
    repository: input.repository,
    path: "src/config/index.ts",
    ref: input.branch,
    signal: input.signal,
  });
  const fieldManifestJson = await input.github.getFileText({
    owner: input.owner,
    repository: input.repository,
    path: "intake/field-manifest.json",
    ref: input.branch,
    signal: input.signal,
  });
  if (!schemaTs || !indexTs || !fieldManifestJson) {
    throw new Error(
      "Client repository is missing schema, derived config, or intake field-manifest files.",
    );
  }
  const patched = patchAstroSiteWorkerRuntimeFiles({
    schemaTs,
    indexTs,
    fieldManifestJson,
  });
  if (!patched.fieldManifestJson) {
    throw new Error("Intake field-manifest could not be patched for Workers.");
  }

  const commit = await input.github.commitFiles({
    owner: input.owner,
    repository: input.repository,
    branch: input.branch,
    message: input.message,
    files: [
      { path: ASTRO_SITE_MANIFEST.configPath, content: input.generatedConfig },
      {
        path: "wrangler.toml",
        content: renderAstroSiteWranglerToml(input.wrangler),
      },
      { path: "src/config/schema.ts", content: patched.schemaTs },
      { path: "src/config/index.ts", content: patched.indexTs },
      { path: "intake/field-manifest.json", content: patched.fieldManifestJson },
    ],
    signal: input.signal,
  });
  return { commitSha: commit.commitSha };
}
