import { describe, expect, it } from "vitest";
import { renderWranglerToml } from "./wranglerConfig";

const input = {
  workerName: "northland-simple-form",
  compatibilityDate: "2026-08-11",
  environment: "production",
  metaGraphApiVersion: "v26.0",
  kvNamespaceId: "00000000000000000000000000000001",
  d1DatabaseName: "northland-paid-funnel-events",
  d1DatabaseId: "00000000-0000-0000-0000-000000000001",
  primaryQueueName: "northland-capi-retries",
  deadLetterQueueName: "northland-capi-dead-letter",
} as const;

describe("wrangler.toml renderer", () => {
  it("renders the complete Simple Form Worker configuration deterministically", () => {
    const first = renderWranglerToml(input);
    const second = renderWranglerToml(input);

    expect(first).toBe(second);
    expect(first).toBe(`name = "northland-simple-form"
main = "./src/worker.ts"
compatibility_date = "2026-08-11"
compatibility_flags = ["nodejs_compat"]

[assets]
binding = "ASSETS"
directory = "./dist"
not_found_handling = "404-page"

[observability]
enabled = true

[vars]
ENVIRONMENT = "production"
META_GRAPH_API_VERSION = "v26.0"

[[kv_namespaces]]
binding = "FUNNEL_SESSIONS"
id = "00000000000000000000000000000001"

[[d1_databases]]
binding = "FUNNEL_DB"
database_name = "northland-paid-funnel-events"
database_id = "00000000-0000-0000-0000-000000000001"
migrations_dir = "migrations"

[[queues.producers]]
binding = "CAPI_RETRY_QUEUE"
queue = "northland-capi-retries"

[[queues.consumers]]
queue = "northland-capi-retries"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 100
dead_letter_queue = "northland-capi-dead-letter"
`);
  });

  it("escapes TOML string inputs instead of allowing line injection", () => {
    const rendered = renderWranglerToml({
      ...input,
      workerName: 'safe-name"\nunsafe = "value',
    });

    expect(rendered).toContain('name = "safe-name\\"\\nunsafe = \\"value"');
    expect(rendered).not.toContain('\nunsafe = "value"\n');
  });
});
