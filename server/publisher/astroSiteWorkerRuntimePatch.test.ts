import { describe, expect, it } from "vitest";
import { patchAstroSiteWorkerRuntimeFiles } from "./astroSiteWorkerRuntimePatch";

const APPROVED_SCHEMA_FRAGMENT = `  foundedYear: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear()),
`;

const APPROVED_INDEX_FRAGMENT = `  // Identity
  yearsInBusiness: new Date().getFullYear() - site.identity.foundedYear,
  copyrightLine: \`© \${new Date().getFullYear()} \${site.identity.name}. All rights reserved.\`,
`;

const APPROVED_MANIFEST_FRAGMENT = `{
      "path": "identity.foundedYear",
      "type": "number",
      "constraints": {
        "integer": true,
        "min": 1800,
        "max": 2026
      }
    }`;

describe("Astro Worker Date-freeze overlay", () => {
  it("replaces module-init Date usage that Workers freeze to 1970", () => {
    const patched = patchAstroSiteWorkerRuntimeFiles({
      schemaTs: APPROVED_SCHEMA_FRAGMENT,
      indexTs: APPROVED_INDEX_FRAGMENT,
      fieldManifestJson: APPROVED_MANIFEST_FRAGMENT,
    });

    expect(patched.schemaTs).toContain(
      ".max(new Date().getFullYear() >= 2000 ? new Date().getFullYear() : 2100)",
    );
    expect(patched.schemaTs).not.toMatch(/\.max\(new Date\(\)\.getFullYear\(\)\),/);
    expect(patched.indexTs).toContain("get yearsInBusiness()");
    expect(patched.indexTs).toContain("get copyrightLine()");
    expect(patched.indexTs).not.toMatch(
      /^\s*yearsInBusiness: new Date\(\)\.getFullYear\(\)/m,
    );
    expect(patched.fieldManifestJson).toContain(`"max": ${new Date().getFullYear()}`);
  });

  it("is idempotent on already-patched template files", () => {
    const first = patchAstroSiteWorkerRuntimeFiles({
      schemaTs: APPROVED_SCHEMA_FRAGMENT,
      indexTs: APPROVED_INDEX_FRAGMENT,
      fieldManifestJson: APPROVED_MANIFEST_FRAGMENT,
    });
    const second = patchAstroSiteWorkerRuntimeFiles(first);
    expect(second).toEqual(first);
  });
});
