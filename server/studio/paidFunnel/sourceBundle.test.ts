import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "../../../shared/paidFunnel/fixture";
import { buildGenericPaidFunnelPackageFixture } from "../../../shared/studio/paidFunnelPackage";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "../../../shared/simpleFormContract";
import {
  buildReadyPaidFunnelProfileDto,
  buildReadyPaidFunnelSecrets,
  memoryProfileResolver,
} from "./profileMapping";
import { buildGenericPaidFunnelSourceBundle } from "./sourceBundle";

describe("generic paid-funnel source bundle", () => {
  it("wires one saved customer profile into runtime bindings without compiling secrets", () => {
    const clientId = 17;
    const profile = {
      clientId,
      dto: buildReadyPaidFunnelProfileDto(clientId),
      secrets: buildReadyPaidFunnelSecrets(),
    };
    const result = buildGenericPaidFunnelSourceBundle({
      clientId,
      funnelId: 101,
      graph: createGenericPaidFunnelFixture("bundle"),
      package: buildGenericPaidFunnelPackageFixture(),
      resolver: memoryProfileResolver([profile]),
    });

    expect(result.runtimeVars).toEqual(
      expect.objectContaining({
        GHL_LOCATION_ID: "location-123",
        GOOGLE_SHEETS_ID: "sheet-123",
        FUNNEL_SHEET_TAB: "SL-17-101",
        META_PIXEL_ID: "123456789012345",
        META_GRAPH_API_VERSION: "v26.0",
      })
    );
    expect(result.bindings.bindingNames).toEqual(
      expect.arrayContaining([
        "GHL_API_KEY",
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
        "META_CAPI_ACCESS_TOKEN",
        "META_VALUE_QUALIFIED",
        "META_VALUE_SCHEDULE",
        "META_VALUE_SHOWED",
      ])
    );
    const source = JSON.stringify(result.files);
    for (const name of [
      "GHL_API_KEY",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "META_CAPI_ACCESS_TOKEN",
      "STAGE_WEBHOOK_SECRET",
    ] as const)
      expect(source).not.toContain(result.bindings.secrets[name]!);
  });

  it("isolates each funnel in a stable tab inside the client's spreadsheet", () => {
    const clientId = 17;
    const profile = {
      clientId,
      dto: buildReadyPaidFunnelProfileDto(clientId),
      secrets: buildReadyPaidFunnelSecrets(),
    };
    const build = (funnelId: number) =>
      buildGenericPaidFunnelSourceBundle({
        clientId,
        funnelId,
        graph: createGenericPaidFunnelFixture(`bundle-${funnelId}`),
        package: buildGenericPaidFunnelPackageFixture(),
        resolver: memoryProfileResolver([profile]),
      });

    expect(build(201).runtimeVars.FUNNEL_SHEET_TAB).toBe("SL-17-201");
    expect(build(202).runtimeVars.FUNNEL_SHEET_TAB).toBe("SL-17-202");
  });

  it("fail-closes when a required saved value is absent", () => {
    const clientId = 18;
    const secrets = buildReadyPaidFunnelSecrets();
    delete secrets.GHL_API_KEY;
    expect(() =>
      buildGenericPaidFunnelSourceBundle({
        clientId,
        funnelId: 102,
        graph: createGenericPaidFunnelFixture("missing"),
        package: buildGenericPaidFunnelPackageFixture(),
        resolver: memoryProfileResolver([
          {
            clientId,
            dto: buildReadyPaidFunnelProfileDto(clientId),
            secrets,
          },
        ]),
      })
    ).toThrow(/GHL_API_KEY/);
  });

  it.each(SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets)(
    "blocks source publishing when required runtime value %s is absent",
    key => {
      const clientId = 21;
      const dto = buildReadyPaidFunnelProfileDto(clientId);
      const secrets = buildReadyPaidFunnelSecrets();
      if (key in dto.identifiers) {
        (dto.identifiers as Record<string, string | null>)[key] = null;
      } else {
        delete (secrets as Record<string, string | undefined>)[key];
      }

      expect(() =>
        buildGenericPaidFunnelSourceBundle({
          clientId,
          funnelId: 103,
          graph: createGenericPaidFunnelFixture("missing-contract-value"),
          package: buildGenericPaidFunnelPackageFixture(),
          resolver: memoryProfileResolver([{ clientId, dto, secrets }]),
        })
      ).toThrow(new RegExp(key));
    }
  );

  it("fail-closes when a legacy saved value is present but malformed", () => {
    const clientId = 19;
    const secrets = buildReadyPaidFunnelSecrets();
    secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL = "not-a-service-account@example.com";
    expect(() =>
      buildGenericPaidFunnelSourceBundle({
        clientId,
        funnelId: 104,
        graph: createGenericPaidFunnelFixture("malformed"),
        package: buildGenericPaidFunnelPackageFixture(),
        resolver: memoryProfileResolver([
          {
            clientId,
            dto: buildReadyPaidFunnelProfileDto(clientId),
            secrets,
          },
        ]),
      })
    ).toThrow(/service-account/i);
  });
});
