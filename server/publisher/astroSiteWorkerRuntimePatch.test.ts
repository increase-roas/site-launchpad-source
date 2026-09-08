import { describe, expect, it } from "vitest";
import {
  homepageSectionVariantsFromSource,
  patchAstroSiteWorkerRuntimeFiles,
} from "./astroSiteWorkerRuntimePatch";

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

const SECTIONS_SCHEMA_FRAGMENT = `
const offerCardSchema = z.object({
  type: z.literal('offercard'),
});
const categoriesSchema = z.object({
  type: z.literal('categories'),
});
const productsSchema = z.object({
  type: z.literal('products'),
});
const countdownSchema = z.object({
  type: z.literal('countdown'),
});
export const sectionSchema = z.discriminatedUnion('type', [
  offerCardSchema,
  categoriesSchema,
  productsSchema,
  countdownSchema,
]);
`;

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

  it("rewrites a fixed .max(2100) so intake still rejects future founding years", () => {
    const patched = patchAstroSiteWorkerRuntimeFiles({
      schemaTs: `  foundedYear: z.number().max(2100),`,
      indexTs: APPROVED_INDEX_FRAGMENT,
      fieldManifestJson: APPROVED_MANIFEST_FRAGMENT,
    });
    expect(patched.schemaTs).toContain(
      ".max(new Date().getFullYear() >= 2000 ? new Date().getFullYear() : 2100)",
    );
    expect(patched.fieldManifestJson).toContain(`"max": ${new Date().getFullYear()}`);
  });

  it("reads homepage section variants in discriminated-union order", () => {
    expect(homepageSectionVariantsFromSource(SECTIONS_SCHEMA_FRAGMENT)).toEqual([
      "offercard",
      "categories",
      "products",
      "countdown",
    ]);
  });

  it("adds missing homepage section variants without rewriting the rest of the manifest", () => {
    const fieldManifestJson = `{
  "fields": [
    {
      "path": "homepage.sections",
      "constraints": {
        "variants": [
          "offercard",
          "categories"
        ]
      }
    }
  ]
}
`;
    const patched = patchAstroSiteWorkerRuntimeFiles({
      schemaTs: `  foundedYear: z.number().max(2100),`,
      indexTs: APPROVED_INDEX_FRAGMENT,
      fieldManifestJson,
      sectionsSchemaTs: SECTIONS_SCHEMA_FRAGMENT,
    });
    expect(patched.fieldManifestJson).toMatch(
      /"offercard",\s*"categories",\s*"products",\s*"countdown"/s,
    );
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
