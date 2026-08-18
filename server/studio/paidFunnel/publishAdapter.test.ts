import { describe, expect, it } from "vitest";
import {
  buildGenericPaidFunnelPackageFixture,
  buildGenericPaidFunnelSettingsFixture,
} from "../../../shared/studio/paidFunnelPackage";
import {
  GENERIC_PAID_FUNNEL_ADAPTER,
  assertGenericPaidFunnelPublishAuthorized,
  genericPaidFunnelUsesForcedInfra,
  planGenericPaidFunnelPublish,
  selectPaidFunnelPublishAdapter,
} from "./publishAdapter";

describe("generic paid-funnel publish adapter", () => {
  it("selects the generic adapter and plans no forced KV/D1/queues", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const selected = selectPaidFunnelPublishAdapter(pkg);
    const planned = planGenericPaidFunnelPublish(pkg, settings);

    expect(selected).toEqual({
      ok: true,
      adapter: GENERIC_PAID_FUNNEL_ADAPTER,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || !planned.plan) throw new Error("expected a plan");
    expect(planned.plan.adapter).toBe(GENERIC_PAID_FUNNEL_ADAPTER);
    expect(planned.plan.forcedCloudflareInfra).toBe(false);
    expect(planned.plan.resources).toEqual({});
    expect(planned.plan.steps).toEqual([
      "validate_readiness",
      "create_repository",
      "commit_source",
      "dispatch_workflow",
      "monitor_workflow",
      "patch_runtime_secrets",
      "get_live_url",
      "published",
    ]);
    expect(genericPaidFunnelUsesForcedInfra(planned.plan)).toBe(false);
    expect(assertGenericPaidFunnelPublishAuthorized(pkg, settings)).toEqual(
      planned.plan
    );
  });

  it("plans only resources declared on the package contract", () => {
    const pkg = buildGenericPaidFunnelPackageFixture({
      resources: {
        kvNamespaces: [{ binding: "FUNNEL_SESSIONS" }],
        d1Databases: [
          { binding: "FUNNEL_DB", databaseName: "paid-funnel-events" },
        ],
        queues: {
          producers: [
            { binding: "CAPI_RETRY_QUEUE", queue: "paid-funnel-capi-retries" },
          ],
          consumers: [
            {
              queue: "paid-funnel-capi-retries",
              deadLetterQueue: "paid-funnel-capi-dead-letter",
            },
          ],
        },
      },
    });
    const planned = planGenericPaidFunnelPublish(
      pkg,
      buildGenericPaidFunnelSettingsFixture(pkg)
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok || !planned.plan) throw new Error("expected a plan");
    expect(planned.plan.steps).toEqual([
      "validate_readiness",
      "create_repository",
      "ensure_kv_namespace",
      "ensure_d1_database",
      "ensure_queues",
      "commit_source",
      "dispatch_workflow",
      "monitor_workflow",
      "patch_runtime_secrets",
      "get_live_url",
      "published",
    ]);
    expect(planned.plan.resources.kvNamespaces).toEqual([
      { binding: "FUNNEL_SESSIONS" },
    ]);
  });

  it("refuses to plan when readiness is not fully closed-ready", () => {
    const pkg = buildGenericPaidFunnelPackageFixture();
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    settings.secretPresence.META_CAPI_ACCESS_TOKEN = false;
    const planned = planGenericPaidFunnelPublish(pkg, settings);
    expect(planned.ok).toBe(false);
    expect(planned.plan).toBeNull();
    expect(planned.ok ? "" : planned.error).toContain("META_CAPI_ACCESS_TOKEN");
    expect(() =>
      assertGenericPaidFunnelPublishAuthorized(pkg, settings)
    ).toThrow(/META_CAPI_ACCESS_TOKEN/);
  });

  it("refuses the specialized Simple Form adapter and website packages", () => {
    const simpleForm = selectPaidFunnelPublishAdapter(
      buildGenericPaidFunnelPackageFixture({
        publishAdapter: "legacy-simple-form",
      })
    );
    expect(simpleForm.ok).toBe(false);
    if (simpleForm.ok) throw new Error("expected refusal");
    expect(simpleForm.error).toContain("specialized Simple Form adapter");

    const website = selectPaidFunnelPublishAdapter({
      ...buildGenericPaidFunnelPackageFixture(),
      kind: "website",
    });
    expect(website.ok).toBe(false);
  });
});
