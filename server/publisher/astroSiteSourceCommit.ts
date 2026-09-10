import { ASTRO_SITE_MANIFEST } from "../../shared/astroSiteContract";
import {
  renderAstroSiteWranglerToml,
  type AstroSiteWranglerConfigInput,
} from "./astroSiteWranglerConfig";
import { patchAstroSiteWorkerRuntimeFiles } from "./astroSiteWorkerRuntimePatch";
import type { GitHubApiClient } from "./githubApi";

const GENERATED_PATHS = new Set([
  ASTRO_SITE_MANIFEST.configPath,
  "wrangler.toml",
  "src/config/schema.ts",
  "src/config/index.ts",
  "intake/field-manifest.json",
]);

const TEMPLATE_TEXT = /\.(astro|ts|tsx|js|mjs|cjs|css|json|md|toml|yml|yaml|svg|html|txt)$/i;

function templateRepo(): { owner: string; repository: string } {
  const [owner, repository, extra] = ASTRO_SITE_MANIFEST.repo.split("/");
  if (!owner || !repository || extra) {
    throw new Error("Astro template repository name is invalid.");
  }
  return { owner, repository };
}

export function shouldSyncTemplatePath(filePath: string): boolean {
  if (GENERATED_PATHS.has(filePath)) return false;
  if (filePath.startsWith("node_modules/") || filePath.startsWith("dist/")) return false;
  return TEMPLATE_TEXT.test(filePath);
}

export function astroSiteSessionKvTitle(workerName: string): string {
  return `${workerName}-session`;
}

export async function commitAstroSiteGeneratedSource(input: {
  github: Pick<
    GitHubApiClient,
    "getFileText" | "findCommitByMessage" | "commitFiles"
  > &
    Partial<Pick<GitHubApiClient, "listRepositoryBlobs">>;
  owner: string;
  repository: string;
  branch: string;
  message: string;
  generatedConfig: string;
  wrangler: AstroSiteWranglerConfigInput;
  signal: AbortSignal;
  templateRef?: string;
}): Promise<{ commitSha: string }> {
  const existing = await input.github.findCommitByMessage({
    owner: input.owner,
    repository: input.repository,
    branch: input.branch,
    message: input.message,
    signal: input.signal,
  });
  if (existing) return existing;

  const template = templateRepo();
  const templateRef = input.templateRef ?? ASTRO_SITE_MANIFEST.defaultBranch;
  const fromTemplate = {
    owner: template.owner,
    repository: template.repository,
    ref: templateRef,
    signal: input.signal,
  };

  const schemaTs = await input.github.getFileText({
    ...fromTemplate,
    path: "src/config/schema.ts",
  });
  const indexTs = await input.github.getFileText({
    ...fromTemplate,
    path: "src/config/index.ts",
  });
  const fieldManifestJson = await input.github.getFileText({
    ...fromTemplate,
    path: "intake/field-manifest.json",
  });
  const sectionsSchemaTs = await input.github.getFileText({
    ...fromTemplate,
    path: "src/config/sections.schema.ts",
  });
  if (!schemaTs || !indexTs || !fieldManifestJson) {
    throw new Error(
      "Template repository is missing schema, derived config, or intake field-manifest files.",
    );
  }
  const patched = patchAstroSiteWorkerRuntimeFiles({
    schemaTs,
    indexTs,
    fieldManifestJson,
    sectionsSchemaTs: sectionsSchemaTs ?? undefined,
  });
  if (!patched.fieldManifestJson) {
    throw new Error("Intake field-manifest could not be patched for Workers.");
  }

  const files = [
    { path: ASTRO_SITE_MANIFEST.configPath, content: input.generatedConfig },
    {
      path: "wrangler.toml",
      content: renderAstroSiteWranglerToml(input.wrangler),
    },
    { path: "src/config/schema.ts", content: patched.schemaTs },
    { path: "src/config/index.ts", content: patched.indexTs },
    { path: "intake/field-manifest.json", content: patched.fieldManifestJson },
  ];

  if (input.github.listRepositoryBlobs) {
    const blobs = (await input.github.listRepositoryBlobs(fromTemplate)).filter(
      shouldSyncTemplatePath,
    );
    const concurrency = 8;
    for (let index = 0; index < blobs.length; index += concurrency) {
      const batch = blobs.slice(index, index + concurrency);
      const fetched = await Promise.all(
        batch.map(async filePath => {
          const content = await input.github.getFileText({
            ...fromTemplate,
            path: filePath,
          });
          return content == null ? null : { path: filePath, content };
        }),
      );
      for (const file of fetched) {
        if (file) files.push(file);
      }
    }
  }

  const commit = await input.github.commitFiles({
    owner: input.owner,
    repository: input.repository,
    branch: input.branch,
    message: input.message,
    files,
    signal: input.signal,
  });
  return { commitSha: commit.commitSha };
}
