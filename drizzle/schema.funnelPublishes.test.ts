import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("funnel publish job schema", () => {
  it("enforces one leased RLS-enabled publish job per funnel", () => {
    expect(schema.funnelPublishes).toBeDefined();
    const config = getTableConfig(schema.funnelPublishes);
    const columns = Object.fromEntries(
      config.columns.map(column => [column.name, column])
    );
    const indexes = config.indexes.map(index => index.config.name);

    expect(columns.funnelId?.notNull).toBe(true);
    expect(columns.externalFunnelId?.notNull).toBe(true);
    expect(columns.leaseToken?.notNull).toBe(false);
    expect(columns.leaseUntil?.notNull).toBe(false);
    expect(columns.dispatchRequestedAt?.notNull).toBe(false);
    expect(columns.workflowRunId?.notNull).toBe(false);
    expect(columns.kvNamespaceId?.notNull).toBe(false);
    expect(columns.d1DatabaseId?.notNull).toBe(false);
    expect(columns.primaryQueueId?.notNull).toBe(false);
    expect(columns.deadLetterQueueId?.notNull).toBe(false);
    expect(columns.runtimeSecretsPatchedAt?.notNull).toBe(false);
    expect(indexes).toEqual(
      expect.arrayContaining([
        "funnel_publishes_funnel_unique",
        "funnel_publishes_external_funnel_unique",
        "funnel_publishes_status_idx",
        "funnel_publishes_lease_until_idx",
      ])
    );
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});
