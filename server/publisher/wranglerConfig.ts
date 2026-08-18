export type WranglerConfigInput = {
  workerName: string;
  compatibilityDate: string;
  environment: string;
  metaGraphApiVersion: string;
  kvNamespaceId: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  primaryQueueName: string;
  deadLetterQueueName: string;
};

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function renderWranglerToml(input: WranglerConfigInput): string {
  return `name = ${tomlString(input.workerName)}
main = "./src/worker.ts"
compatibility_date = ${tomlString(input.compatibilityDate)}
compatibility_flags = ["nodejs_compat"]

[assets]
binding = "ASSETS"
directory = "./dist"
not_found_handling = "404-page"

[observability]
enabled = true

[vars]
ENVIRONMENT = ${tomlString(input.environment)}
META_GRAPH_API_VERSION = ${tomlString(input.metaGraphApiVersion)}

[[kv_namespaces]]
binding = "FUNNEL_SESSIONS"
id = ${tomlString(input.kvNamespaceId)}

[[d1_databases]]
binding = "FUNNEL_DB"
database_name = ${tomlString(input.d1DatabaseName)}
database_id = ${tomlString(input.d1DatabaseId)}
migrations_dir = "migrations"

[[queues.producers]]
binding = "CAPI_RETRY_QUEUE"
queue = ${tomlString(input.primaryQueueName)}

[[queues.consumers]]
queue = ${tomlString(input.primaryQueueName)}
max_batch_size = 10
max_batch_timeout = 5
max_retries = 100
dead_letter_queue = ${tomlString(input.deadLetterQueueName)}
`;
}
