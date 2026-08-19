import { describe, expect, it } from "vitest";
import {
  buildGenericPaidFunnelPackageFixture,
  buildGenericPaidFunnelSettingsFixture,
} from "../../../shared/studio/paidFunnelPackage";
import {
  buildReadyPaidFunnelProfileDto,
  buildReadyPaidFunnelSecrets,
  memoryProfileResolver,
} from "./profileMapping";
import {
  GENERIC_PAID_FUNNEL_ADAPTER,
  assertGenericPaidFunnelPublishAuthorized,
  genericPaidFunnelUsesForcedInfra,
  mapGenericPaidFunnelProfileBindings,
  planGenericPaidFunnelPublish,
  selectPaidFunnelPublishAdapter,
} from "./publishAdapter";

function readyContext() {
  const pkg = buildGenericPaidFunnelPackageFixture();
  const settings = buildGenericPaidFunnelSettingsFixture(pkg);
  const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
  return { pkg, settings, profile };
}

describe("generic paid-funnel publish adapter", () => {
  it("selects the generic adapter and plans only its declared attribution database", () => {
    const { pkg, settings, profile } = readyContext();
    const selected = selectPaidFunnelPublishAdapter(pkg);
    const planned = planGenericPaidFunnelPublish(pkg, settings, profile);

    expect(selected).toEqual({
      ok: true,
      adapter: GENERIC_PAID_FUNNEL_ADAPTER,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || !planned.plan) throw new Error("expected a plan");
    expect(planned.plan.adapter).toBe(GENERIC_PAID_FUNNEL_ADAPTER);
    expect(planned.plan.forcedCloudflareInfra).toBe(false);
    expect(planned.plan.resources).toEqual({
      d1Databases: [
        { binding: "FUNNEL_DB", databaseName: "paid-funnel-events" },
      ],
    });
    expect(planned.plan.clientId).toBe(settings.clientId);
    expect(planned.plan.bindingNames).toEqual(
      expect.arrayContaining([
        "GHL_API_KEY",
        "GHL_LOCATION_ID",
        "STAGE_WEBHOOK_SECRET",
      ])
    );
    expect(planned.plan.steps).toEqual([
      "validate_readiness",
      "create_repository",
      "ensure_d1_database",
      "commit_source",
      "dispatch_workflow",
      "monitor_workflow",
      "patch_runtime_secrets",
      "get_live_url",
      "published",
    ]);
    expect(genericPaidFunnelUsesForcedInfra(planned.plan)).toBe(false);
    expect(assertGenericPaidFunnelPublishAuthorized(pkg, settings, profile)).toEqual(
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
    const settings = buildGenericPaidFunnelSettingsFixture(pkg);
    const planned = planGenericPaidFunnelPublish(
      pkg,
      settings,
      buildReadyPaidFunnelProfileDto(settings.clientId)
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
    const profile = buildReadyPaidFunnelProfileDto(settings.clientId);
    profile.secretPresence.STAGE_WEBHOOK_SECRET = "NOT SET";
    const planned = planGenericPaidFunnelPublish(pkg, settings, profile);
    expect(planned.ok).toBe(false);
    expect(planned.plan).toBeNull();
    expect(planned.ok ? "" : planned.error).toContain("STAGE_WEBHOOK_SECRET");
    expect(() =>
      assertGenericPaidFunnelPublishAuthorized(pkg, settings, profile)
    ).toThrow(/STAGE_WEBHOOK_SECRET/);
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

  it("does not silently rewrite an existing live deploy", () => {
    const { pkg, settings, profile } = readyContext();
    const blocked = planGenericPaidFunnelPublish(pkg, settings, profile, {
      hasLiveDeploy: true,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? "" : blocked.error).toMatch(
      /Republish or Sync Integrations/
    );

    const republish = planGenericPaidFunnelPublish(pkg, settings, profile, {
      hasLiveDeploy: true,
      action: "republish",
    });
    expect(republish.ok).toBe(true);
    if (!republish.ok || !republish.plan) throw new Error("expected republish");
    expect(republish.plan.liveSyncAction).toBe("republish");
    expect(republish.plan.steps).toContain("create_repository");

    const sync = planGenericPaidFunnelPublish(pkg, settings, profile, {
      hasLiveDeploy: true,
      action: "sync-integrations",
    });
    expect(sync.ok).toBe(true);
    if (!sync.ok || !sync.plan) throw new Error("expected sync");
    expect(sync.plan.liveSyncAction).toBe("sync-integrations");
    expect(sync.plan.steps).toEqual([
      "validate_readiness",
      "patch_runtime_secrets",
      "published",
    ]);
  });

  it("resolves the profile by clientId and maps bindings without logging values", () => {
    const { pkg, settings, profile } = readyContext();
    const secrets = buildReadyPaidFunnelSecrets();
    const resolver = memoryProfileResolver([
      { clientId: settings.clientId, dto: profile, secrets },
    ]);
    const planned = planGenericPaidFunnelPublish(pkg, settings, undefined, {
      resolver,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok || !planned.plan) throw new Error("expected a plan");
    expect(planned.plan.clientId).toBe(5);

    const mapped = mapGenericPaidFunnelProfileBindings({
      clientId: settings.clientId,
      package: pkg,
      resolver,
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) throw new Error(mapped.error);
    expect(mapped.bindings.env.GHL_LOCATION_ID).toBe("location-123");
    expect(mapped.bindings.secrets.GHL_API_KEY).toBe("ghl-live-api-key-AAA");
    expect(mapped.bindings.secrets.ALERT_WEBHOOK_URL).toBe(
      "https://alerts.example/hook"
    );
    expect(mapped.bindings.secrets).not.toHaveProperty("META_VALUE_QUALIFIED");
    expect(mapped.bindings.secrets).not.toHaveProperty("META_VALUE_SCHEDULE");
    expect(mapped.bindings.secrets).not.toHaveProperty("META_VALUE_SHOWED");
    expect(JSON.stringify(planned)).not.toContain("ghl-live-api-key-AAA");
    expect(mapped.bindings.bindingNames).not.toEqual(
      expect.arrayContaining([
        "META_VALUE_QUALIFIED",
        "META_VALUE_SCHEDULE",
        "META_VALUE_SHOWED",
      ])
    );
  });
});
