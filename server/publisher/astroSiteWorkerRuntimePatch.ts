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

export function patchAstroSiteWorkerRuntimeFiles(input: {
  schemaTs: string;
  indexTs: string;
  fieldManifestJson?: string;
}): { schemaTs: string; indexTs: string; fieldManifestJson?: string } {
  return {
    schemaTs: patchFoundedYearMax(input.schemaTs),
    indexTs: patchDerivedDateFields(input.indexTs),
    ...(input.fieldManifestJson === undefined
      ? {}
      : { fieldManifestJson: patchFoundedYearManifestMax(input.fieldManifestJson) }),
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

function patchFoundedYearManifestMax(fieldManifestJson: string): string {
  if (!FOUNDED_YEAR_MANIFEST.test(fieldManifestJson)) {
    throw new Error(
      "intake/field-manifest.json does not contain identity.foundedYear max that can be patched for Workers.",
    );
  }
  const year = new Date().getFullYear();
  const walkedMax = year >= 2000 ? year : 2100;
  return fieldManifestJson.replace(
    FOUNDED_YEAR_MANIFEST,
    (_match, prefix: string) => `${prefix}${walkedMax}`,
  );
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
