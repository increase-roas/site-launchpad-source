import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { genericPaidFunnelPublishes } from "./schema";

describe("generic paid funnel publish schema", () => {
  it("uses a dedicated RLS table with one durable job per funnel", () => {
    const config = getTableConfig(genericPaidFunnelPublishes);
    expect(config.name).toBe("generic_paid_funnel_publishes");
    expect(config.enableRLS).toBe(true);
    expect(config.indexes.map(index => index.config.name)).toEqual(
      expect.arrayContaining([
        "generic_paid_funnel_publishes_funnel_unique",
        "generic_paid_funnel_publishes_external_unique",
        "generic_paid_funnel_publishes_lease_until_idx",
      ]),
    );
  });
});
