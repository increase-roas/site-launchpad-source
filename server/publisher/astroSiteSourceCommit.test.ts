import { describe, expect, it, vi } from "vitest";
import { commitAstroSiteGeneratedSource } from "./astroSiteSourceCommit";

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
  });
});
