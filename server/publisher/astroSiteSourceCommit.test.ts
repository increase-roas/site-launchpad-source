import { describe, expect, it, vi } from "vitest";
import {
  commitAstroSiteGeneratedSource,
  shouldSyncTemplatePath,
} from "./astroSiteSourceCommit";

const SCHEMA = `  foundedYear: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear()),
`;
const INDEX = `  // Identity
  yearsInBusiness: new Date().getFullYear() - site.identity.foundedYear,
  copyrightLine: \`© \${new Date().getFullYear()} \${site.identity.name}. All rights reserved.\`,
`;

describe("Astro site source commit", () => {
  it("commits config, wrangler SESSION binding, and Worker Date-freeze overlays", async () => {
    const commitFiles = vi.fn().mockResolvedValue({ commitSha: "abc123" });
    const github = {
      findCommitByMessage: vi.fn().mockResolvedValue(null),
      getFileText: vi.fn(async (input: { path: string }) => {
        if (input.path.endsWith("schema.ts")) return SCHEMA;
        if (input.path.endsWith("index.ts")) return INDEX;
        if (input.path.endsWith("field-manifest.json")) {
          return `{
      "path": "identity.foundedYear",
      "constraints": { "integer": true, "min": 1800, "max": 2026 }
    }`;
        }
        return null;
      }),
      commitFiles,
    };

    await expect(
      commitAstroSiteGeneratedSource({
        github,
        owner: "increase-roas",
        repository: "website-theme-matrix-qa-7",
        branch: "main",
        message: "Generate preview for client 7 revision 2 job job-1",
        generatedConfig: "export const rawClientConfig = {};",
        wrangler: {
          workerName: "website-theme-matrix-qa-7-preview",
          d1DatabaseName: "website-theme-matrix-qa-7-preview-inventory",
          d1DatabaseId: "d1-id",
          r2BucketName: "website-theme-matrix-qa-7-images",
          sessionKvNamespaceId: "kv-id",
        },
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ commitSha: "abc123" });

    const files = commitFiles.mock.calls[0]?.[0]?.files as Array<{
      path: string;
      content: string;
    }>;
    expect(files.map(file => file.path)).toEqual([
      "src/config/client.config.ts",
      "wrangler.toml",
      "src/config/schema.ts",
      "src/config/index.ts",
      "intake/field-manifest.json",
    ]);
    expect(files[1]?.content).toContain('binding = "SESSION"');
    expect(files[1]?.content).toContain('id = "kv-id"');
    expect(files[2]?.content).toContain(
      ".max(new Date().getFullYear() >= 2000 ? new Date().getFullYear() : 2100)",
    );
    expect(files[3]?.content).toContain("get yearsInBusiness()");
    expect(files[4]?.content).toContain(`"max": ${new Date().getFullYear()}`);
    expect(github.getFileText).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "increase-roas",
        repository: "32-htl-website-template-astrobuild",
        path: "src/config/schema.ts",
        ref: "main",
      }),
    );
  });

  it("copies live template text files into an existing client repo", async () => {
    const commitFiles = vi.fn().mockResolvedValue({ commitSha: "def456" });
    const github = {
      findCommitByMessage: vi.fn().mockResolvedValue(null),
      listRepositoryBlobs: vi.fn().mockResolvedValue([
        "src/styles/theme.css",
        "src/config/client.config.ts",
        "wrangler.toml",
        "node_modules/left-pad/index.js",
        "public/hero.webp",
      ]),
      getFileText: vi.fn(async (input: { path: string }) => {
        if (input.path === "src/styles/theme.css") return "--page-gutter: 24px;";
        if (input.path.endsWith("schema.ts")) return SCHEMA;
        if (input.path.endsWith("index.ts")) return INDEX;
        if (input.path.endsWith("field-manifest.json")) {
          return `{
      "path": "identity.foundedYear",
      "constraints": { "integer": true, "min": 1800, "max": 2026 }
    }`;
        }
        return null;
      }),
      commitFiles,
    };

    await commitAstroSiteGeneratedSource({
      github,
      owner: "increase-roas",
      repository: "website-theme-matrix-qa-7",
      branch: "main",
      message: "Generate preview for client 7 revision 2 job job-1",
      generatedConfig: "export const rawClientConfig = {};",
      wrangler: {
        workerName: "website-theme-matrix-qa-7-preview",
        d1DatabaseName: "website-theme-matrix-qa-7-preview-inventory",
        d1DatabaseId: "d1-id",
        r2BucketName: "website-theme-matrix-qa-7-images",
        sessionKvNamespaceId: "kv-id",
      },
      templateRef: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      signal: new AbortController().signal,
    });

    expect(github.listRepositoryBlobs).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "increase-roas",
        repository: "32-htl-website-template-astrobuild",
        ref: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    );
    const files = commitFiles.mock.calls[0]?.[0]?.files as Array<{
      path: string;
      content: string;
    }>;
    expect(files.map(file => file.path)).toEqual([
      "src/config/client.config.ts",
      "wrangler.toml",
      "src/config/schema.ts",
      "src/config/index.ts",
      "intake/field-manifest.json",
      "src/styles/theme.css",
    ]);
    expect(files.at(-1)?.content).toBe("--page-gutter: 24px;");
  });

  it("syncs template styles and pages but not generated client overlays", () => {
    expect(shouldSyncTemplatePath("src/styles/theme.css")).toBe(true);
    expect(shouldSyncTemplatePath("src/pages/index.astro")).toBe(true);
    expect(shouldSyncTemplatePath("src/config/client.config.ts")).toBe(false);
    expect(shouldSyncTemplatePath("wrangler.toml")).toBe(false);
    expect(shouldSyncTemplatePath("public/hero.webp")).toBe(false);
  });
});
