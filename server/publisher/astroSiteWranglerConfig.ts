export type AstroSiteWranglerConfigInput = {
  workerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  sessionKvNamespaceId: string;
};

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function renderAstroSiteWranglerToml(
  input: AstroSiteWranglerConfigInput,
): string {
  return `name = ${tomlString(input.workerName)}
compatibility_date = "2026-08-01"
compatibility_flags = ["nodejs_compat", "nodejs_als"]

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = ${tomlString(input.d1DatabaseName)}
database_id = ${tomlString(input.d1DatabaseId)}

[[r2_buckets]]
binding = "PRODUCT_IMAGES"
bucket_name = ${tomlString(input.r2BucketName)}

[[kv_namespaces]]
binding = "SESSION"
id = ${tomlString(input.sessionKvNamespaceId)}
`;
}
