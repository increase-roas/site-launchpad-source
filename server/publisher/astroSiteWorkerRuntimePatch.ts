const FOUNDED_YEAR_DATE_MAX = ".max(new Date().getFullYear())";
const FOUNDED_YEAR_FIXED_MAX = ".max(2100)";
const FOUNDED_YEAR_WORKER_SAFE_MAX =
  ".max(new Date().getFullYear() >= 2000 ? new Date().getFullYear() : 2100)";

const IDENTITY_STATIC = `  // Identity
  yearsInBusiness: new Date().getFullYear() - site.identity.foundedYear,
  copyrightLine: \`© \${new Date().getFullYear()} \${site.identity.name}. All rights reserved.\`,`;

const IDENTITY_GETTERS = `  // Identity — getters so Workers Date-freeze at module init cannot
  // stamp copyright as 1970 or a negative years-in-business.
  get yearsInBusiness() {
    return new Date().getFullYear() - site.identity.foundedYear;
  },
  get copyrightLine() {
    return \`© \${new Date().getFullYear()} \${site.identity.name}. All rights reserved.\`;
  },`;

export function homepageSectionVariantsFromSource(source: string): string[] {
  const union = source.match(/z\.discriminatedUnion\(\s*['"]type['"]\s*,\s*\[([^\]]+)\]/s);
  if (!union?.[1]) return [];
  const variants: string[] = [];
  for (const schemaName of union[1].match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
    const declared = source.match(
      new RegExp(
        `(?:const|export const) ${schemaName} = z\\.object\\(\\{[\\s\\S]*?type:\\s*z\\.literal\\('([a-z]+)'\\)`,
      ),
    );
    if (declared?.[1]) variants.push(declared[1]);
  }
  return variants;
}

export function patchAstroSiteWorkerRuntimeFiles(input: {
  schemaTs: string;
  indexTs: string;
  fieldManifestJson?: string;
  sectionsSchemaTs?: string;
}): { schemaTs: string; indexTs: string; fieldManifestJson?: string } {
  const schemaTs = patchFoundedYearMax(input.schemaTs);
  let fieldManifestJson = input.fieldManifestJson;
  if (fieldManifestJson !== undefined) {
    if (schemaTs.includes(FOUNDED_YEAR_WORKER_SAFE_MAX)) {
      const year = new Date().getFullYear();
      fieldManifestJson = patchFoundedYearManifestMax(
        fieldManifestJson,
        year >= 2000 ? year : 2100,
      );
    }
    const variants = input.sectionsSchemaTs
      ? homepageSectionVariantsFromSource(input.sectionsSchemaTs)
      : [];
    if (variants.length > 0) {
      fieldManifestJson = syncHomepageSectionVariants(fieldManifestJson, variants);
    }
  }
  return {
    schemaTs,
    indexTs: patchDerivedDateFields(input.indexTs),
    ...(fieldManifestJson === undefined ? {} : { fieldManifestJson }),
  };
}

function patchFoundedYearMax(schemaTs: string): string {
  if (schemaTs.includes(FOUNDED_YEAR_WORKER_SAFE_MAX)) return schemaTs;
  if (schemaTs.includes(FOUNDED_YEAR_FIXED_MAX)) {
    return schemaTs.replace(FOUNDED_YEAR_FIXED_MAX, FOUNDED_YEAR_WORKER_SAFE_MAX);
  }
  if (!schemaTs.includes(FOUNDED_YEAR_DATE_MAX)) {
    throw new Error(
      "Astro schema.ts does not contain a foundedYear Date max that can be patched for Workers.",
    );
  }
  return schemaTs.replace(
    FOUNDED_YEAR_DATE_MAX,
    `// Workers freeze Date during I/O-free module init, so getFullYear()
    // here would become 1970 and reject every real founding year.
    ${FOUNDED_YEAR_WORKER_SAFE_MAX}`,
  );
}

const FOUNDED_YEAR_MANIFEST =
  /("path"\s*:\s*"identity\.foundedYear"[\s\S]*?"max"\s*:\s*)\d+/;

function patchFoundedYearManifestMax(fieldManifestJson: string, max: number): string {
  if (!FOUNDED_YEAR_MANIFEST.test(fieldManifestJson)) {
    return fieldManifestJson;
  }
  return fieldManifestJson.replace(
    FOUNDED_YEAR_MANIFEST,
    (_match, prefix: string) => `${prefix}${max}`,
  );
}

function syncHomepageSectionVariants(
  fieldManifestJson: string,
  variants: readonly string[],
): string {
  const block = fieldManifestJson.match(
    /("path": "homepage\.sections"[\s\S]*?"variants": \[)([\s\S]*?)(\n\s*\])/,
  );
  if (!block || block.index === undefined) return fieldManifestJson;
  const rendered = variants.map(variant => `\n          "${variant}"`).join(",");
  const next = `${block[1]}${rendered}${block[3]}`;
  const previous = `${block[1]}${block[2]}${block[3]}`;
  if (previous === next) return fieldManifestJson;
  return `${fieldManifestJson.slice(0, block.index)}${next}${fieldManifestJson.slice(block.index + block[0].length)}`;
}

function patchDerivedDateFields(indexTs: string): string {
  if (indexTs.includes("get yearsInBusiness()") && indexTs.includes("get copyrightLine()")) {
    return indexTs;
  }
  if (!indexTs.includes(IDENTITY_STATIC)) {
    throw new Error(
      "Astro index.ts does not contain module-init Date identity fields that can be patched for Workers.",
    );
  }
  return indexTs.replace(IDENTITY_STATIC, IDENTITY_GETTERS);
}
