import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clientLeadIntegrations,
  funnelPublishes,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnels,
} from "../drizzle/schema";
import { buildSimpleFormStoredRecord } from "../shared/simpleFormConfig";
import {
  buildClientIntegrationProfileDto,
  emptySecretPresence,
} from "../shared/clientIntegrationProfile";
import { encryptSetupValue } from "./clientSecurity";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getClientAssets: vi.fn(),
  getClientById: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

const integrationMocks = vi.hoisted(() => ({
  loadOrBackfillResolvedClientIntegrationProfile: vi.fn(),
  saveClientIntegrationProfile: vi.fn(),
}));

vi.mock("./clientIntegrations", () => integrationMocks);

import {
  createSimpleFormFromTemplate,
  getSimpleFormDetail,
  getSimpleFormPublishHandoff,
  getSimpleFormPublishMaterial,
  saveSimpleFormConfig,
  saveSimpleFormIntegration,
  simpleFormSecretPresenceFromProfile,
} from "./simpleFormDb";

function resolvedProfile(input: {
  identifiers?: Partial<{
    GHL_LOCATION_ID: string | null;
    GOOGLE_SHEETS_ID: string | null;
    META_PIXEL_ID: string | null;
  }>;
  secrets?: Partial<Record<
    | "GHL_API_KEY"
    | "META_CAPI_ACCESS_TOKEN"
    | "STAGE_WEBHOOK_SECRET"
    | "GOOGLE_SERVICE_ACCOUNT_EMAIL"
    | "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    | "ALERT_WEBHOOK_URL",
    string
  >>;
} = {}) {
  const identifiers = {
    GHL_LOCATION_ID: "location-123",
    GOOGLE_SHEETS_ID: "sheet-123",
    META_PIXEL_ID: "123456789012345",
    ...input.identifiers,
  };
  const secrets = {
    GHL_API_KEY: "ghl-key",
    META_CAPI_ACCESS_TOKEN: "meta-token",
    STAGE_WEBHOOK_SECRET: "stage-secret",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "publisher@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "private-key",
    ...input.secrets,
  };
  const secretPresence = emptySecretPresence();
  for (const key of Object.keys(secrets) as Array<keyof typeof secretPresence>) {
    if (secrets[key]) secretPresence[key] = "SET";
  }
  return {
    clientId: 5,
    dto: buildClientIntegrationProfileDto({
      clientId: 5,
      identifiers,
      secretPresence,
      lastUpdated: new Date("2026-08-18T12:00:00.000Z"),
      reconciliationStatus: "ready",
      conflictedKeys: [],
    }),
    secrets,
  };
}

beforeEach(() => {
  integrationMocks.loadOrBackfillResolvedClientIntegrationProfile.mockResolvedValue(
    resolvedProfile(),
  );
  integrationMocks.saveClientIntegrationProfile.mockResolvedValue(
    resolvedProfile().dto,
  );
});

it("maps the complete canonical runtime-secret presence into readiness", () => {
  expect(simpleFormSecretPresenceFromProfile(resolvedProfile())).toMatchObject({
    GHL_API_KEY: true,
    META_CAPI_ACCESS_TOKEN: true,
    STAGE_WEBHOOK_SECRET: true,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: true,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: true,
  });

  expect(
    simpleFormSecretPresenceFromProfile(
      resolvedProfile({
        secrets: {
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
          GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "",
        },
      }),
    ),
  ).toMatchObject({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: false,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: false,
  });
});

function buildReadyRecord() {
  const record = buildSimpleFormStoredRecord({
    businessName: "Northland Spas",
    slug: "northland-simple-form",
    phone: "+17015551234",
  });
  record.config.meta.pixelId = "123456789012345";
  record.config.serviceAreaZipCodes = ["58701"];
  record.config.inventory.products = record.config.inventory.products.map(
    (product, index) => ({
      ...product,
      ctaUrl: `https://northland.example/products/${index + 1}`,
    })
  );
  return record;
}

function detailDatabase(
  record: ReturnType<typeof buildReadyRecord>,
  integrationOverrides: Partial<{
    ghlLocationId: string;
    googleSheetsId: string;
    metaPixelId: string;
  }> = {},
  publishJob: { status: string; liveUrl: string | null } | null = null
) {
  const funnel = {
    id: 11,
    clientId: 5,
    name: "Northland Spas Simple Form Funnel",
    slug: "northland-simple-form",
    templateKey: "simple-form",
    templateRepo: "increase-roas/paid-funnel-simple-form-funnel",
    contractVersion: 1,
    shape: "A",
    deploymentStatus: "draft",
    status: "draft",
  };
  const integrationRow = {
    clientId: 5,
    ghlLocationId: "location-123",
    googleSheetsId: "sheet-123",
    metaPixelId: "123456789012345",
    ghlApiKeyEncrypted: encryptSetupValue("ghl-key"),
    metaCapiAccessTokenEncrypted: encryptSetupValue("meta-token"),
    stageWebhookSecretEncrypted: encryptSetupValue("stage-secret"),
    alertWebhookUrlEncrypted: null,
    ...integrationOverrides,
  };
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === funnels) return [funnel];
            if (table === funnelSimpleFormConfigs) {
              return [{ funnelId: 11, configJson: record }];
            }
            if (table === clientLeadIntegrations) return [integrationRow];
            if (table === funnelPublishes) {
              return publishJob
                ? [{ status: publishJob.status, liveUrl: publishJob.liveUrl }]
                : [];
            }
            return [];
          },
        }),
      }),
    }),
  };
}

describe("saveSimpleFormConfig", () => {
  it("rolls back config, funnel, and step updates when a step path update fails", async () => {
    const committed: string[] = [];
    const conflictUpdates: Array<{ target: unknown; set: Record<string, unknown> }> = [];
    const updateSets: Array<Record<string, unknown>> = [];
    let transactionCalls = 0;

    const funnel = {
      id: 11,
      clientId: 5,
      name: "Northland Spas Simple Form Funnel",
      slug: "northland-simple-form",
      templateKey: "simple-form",
    };
    const steps = [
      { id: 21, funnelId: 11, path: "/northland-simple-form/step/1" },
      { id: 22, funnelId: 11, path: "/northland-simple-form/step/2" },
    ];

    const makeDatabase = (writes: string[]) => {
      let stepUpdates = 0;
      return {
        select: () => ({
          from: (table: unknown) => ({
            where: () => {
              const rows = table === funnels ? [funnel] : steps;
              const result = Promise.resolve(rows);
              return Object.assign(result, {
                limit: async (limit: number) => rows.slice(0, limit),
              });
            },
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async (options: {
              target: unknown;
              set: Record<string, unknown>;
            }) => {
              conflictUpdates.push(options);
              writes.push("config");
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => {
            updateSets.push(values);
            return {
              where: async () => {
                if (table === funnels) {
                  writes.push("funnel");
                  return;
                }
                if (table === funnelSteps) {
                  stepUpdates += 1;
                  writes.push(`step-${stepUpdates}`);
                  if (stepUpdates === 2) throw new Error("step update failed");
                }
              },
            };
          },
        }),
      };
    };

    const db = {
      ...makeDatabase(committed),
      transaction: async <T>(
        callback: (transaction: never) => Promise<T>
      ): Promise<T> => {
        transactionCalls += 1;
        const pending: string[] = [];
        const result = await callback(makeDatabase(pending) as never);
        committed.push(...pending);
        return result;
      },
    };
    dbMocks.getDb.mockResolvedValue(db);

    const record = buildSimpleFormStoredRecord({
      businessName: "Northland Spas",
      slug: "northland-renamed-simple-form",
      phone: "+17015551234",
    });

    await expect(saveSimpleFormConfig(5, 11, record)).rejects.toThrow(
      "step update failed"
    );
    expect(transactionCalls).toBe(1);
    expect(committed).toEqual([]);
    expect(conflictUpdates).toEqual([
      {
        target: funnelSimpleFormConfigs.funnelId,
        set: expect.objectContaining({
          configJson: record,
          updatedAt: expect.any(Date),
        }),
      },
    ]);
    expect(updateSets).toHaveLength(3);
    expect(updateSets.every(values => values.updatedAt instanceof Date)).toBe(true);
  });
});

describe("createSimpleFormFromTemplate", () => {
  function databaseThatRejectsTransaction(
    transactionError: unknown,
    racedRows: Array<{ id: number }>,
  ) {
    let funnelLookupCount = 0;
    return {
      select: (fields?: Record<string, unknown>) => ({
        from: () => ({
          where: () => {
            const selectsSlug =
              fields !== undefined && Object.prototype.hasOwnProperty.call(fields, "slug");
            const rows = selectsSlug
              ? []
              : funnelLookupCount++ === 0
                ? []
                : racedRows;
            return Object.assign(Promise.resolve(rows), {
              limit: async (limit: number) => rows.slice(0, limit),
            });
          },
        }),
      }),
      transaction: async <T>(_callback: (transaction: never) => Promise<T>): Promise<T> => {
        throw transactionError;
      },
    };
  }

  it("re-reads and returns the raced funnel only for SQLSTATE 23505", async () => {
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
      phone: "+17015551234",
    });
    dbMocks.getDb.mockResolvedValue(
      databaseThatRejectsTransaction({ code: "23505" }, [{ id: 88 }]),
    );

    await expect(createSimpleFormFromTemplate(5)).resolves.toEqual({
      alreadyExists: true,
      funnelId: 88,
    });
  });

  it("rethrows unrelated transaction failures without treating them as a race", async () => {
    const unrelated = new Error("database unavailable");
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
      phone: "+17015551234",
    });
    dbMocks.getDb.mockResolvedValue(
      databaseThatRejectsTransaction(unrelated, [{ id: 88 }]),
    );

    await expect(createSimpleFormFromTemplate(5)).rejects.toBe(unrelated);
  });
});

describe("Simple Form private candidate validation", () => {
  it("requires the client GHL location before marking configuration ready", async () => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    integrationMocks.loadOrBackfillResolvedClientIntegrationProfile.mockResolvedValue(
      resolvedProfile({ identifiers: { GHL_LOCATION_ID: null } }),
    );
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord(), { ghlLocationId: "" })
    );
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const detail = await getSimpleFormDetail(5, 11);

    expect(detail.readiness.configurationReady).toBe(false);
    expect(
      detail.readiness.sections
        .find(section => section.key === "ghl")
        ?.missing.some(item => item.includes("GHL Location ID"))
    ).toBe(true);
    expect(JSON.stringify(detail)).not.toContain("ghl-key");
  });

  it("returns validated non-secret configuration separately from secret status", async () => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord())
    );
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const handoff = await getSimpleFormPublishHandoff(5, 11);

    expect(handoff.configurationReady).toBe(true);
    expect(handoff.validatedConfiguration).not.toHaveProperty("ghlWebhookUrl");
    expect(handoff.clientIntegration).toEqual({
      GHL_LOCATION_ID: "location-123",
      GOOGLE_SHEETS_ID: "sheet-123",
      META_PIXEL_ID: "123456789012345",
    });
    expect(handoff.secretsPresent.GHL_API_KEY).toBe(true);
    expect(handoff.secretsPresent.META_CAPI_ACCESS_TOKEN).toBe(true);
    expect(handoff.secretsPresent.STAGE_WEBHOOK_SECRET).toBe(true);
    expect(JSON.stringify(handoff)).not.toContain("meta-token");
    expect(JSON.stringify(handoff)).not.toContain("ghl-key");
    expect(JSON.stringify(handoff)).not.toContain("stage-secret");
    expect(JSON.stringify(handoff)).not.toContain("[PRESENT]");
  });

  it("uses the canonical profile for status and publish material without exposing secrets", async () => {
    const profile = resolvedProfile({
      identifiers: { GHL_LOCATION_ID: "astro-saved-location" },
      secrets: {
        GHL_API_KEY: "astro-saved-ghl-key",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "astro-private-key",
      },
    });
    integrationMocks.loadOrBackfillResolvedClientIntegrationProfile.mockResolvedValue(
      profile,
    );
    dbMocks.getDb.mockResolvedValue(detailDatabase(buildReadyRecord()));
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const detail = await getSimpleFormDetail(5, 11);
    const material = await getSimpleFormPublishMaterial({ clientId: 5, funnelId: 11 });

    expect(detail.integration.GHL_LOCATION_ID).toBe("astro-saved-location");
    expect(detail.secretStatus.GHL_API_KEY).toBe(true);
    expect(JSON.stringify(detail)).not.toContain("astro-saved-ghl-key");
    expect(JSON.stringify(detail)).not.toContain("astro-private-key");
    expect(material.runtimeSecrets.GHL_API_KEY).toBe("astro-saved-ghl-key");
    expect(material.config.meta.pixelId).toBe("123456789012345");
    expect(material.runtimeSecrets.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).toBe(
      "astro-private-key",
    );
  });

  it("derives Simple Form published from a completed job live URL", async () => {
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord(), {}, {
        status: "published",
        liveUrl: "https://simple-form-northland-11.example.workers.dev",
      })
    );
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const detail = await getSimpleFormDetail(5, 11);
    const handoff = await getSimpleFormPublishHandoff(5, 11);

    expect(detail.readiness.published).toBe(true);
    expect(handoff.published).toBe(true);
    expect(JSON.stringify(detail)).not.toContain("ghl-key");
  });

  it("keeps Simple Form unpublished without a completed live URL", async () => {
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord(), {}, {
        status: "published",
        liveUrl: null,
      })
    );
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const detail = await getSimpleFormDetail(5, 11);
    expect(detail.readiness.published).toBe(false);
  });

  it("writes Simple Form integration changes to canonical and compatibility stores", async () => {
    const profile = resolvedProfile();
    integrationMocks.loadOrBackfillResolvedClientIntegrationProfile.mockResolvedValue(
      profile,
    );
    const legacyWrites: Array<Record<string, unknown>> = [];
    const database = {
      ...detailDatabase(buildReadyRecord()),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: async () => {
            if (table === clientLeadIntegrations) legacyWrites.push(values);
          },
        }),
      }),
    };
    dbMocks.getDb.mockResolvedValue(database);
    dbMocks.getClientAssets.mockResolvedValue([]);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });

    const result = await saveSimpleFormIntegration(5, 11, {
      GHL_LOCATION_ID: "simple-form-location",
      GHL_API_KEY: "simple-form-secret",
    });

    expect(integrationMocks.saveClientIntegrationProfile).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        identifiers: { GHL_LOCATION_ID: "simple-form-location" },
        replaceSecrets: { GHL_API_KEY: "simple-form-secret" },
        resolveConflictedKeys: ["GHL_LOCATION_ID", "GHL_API_KEY"],
      }),
    );
    expect(legacyWrites).toHaveLength(1);
    expect(legacyWrites[0]).toMatchObject({
      clientId: 5,
      ghlLocationId: "simple-form-location",
    });
    expect(JSON.stringify(result)).not.toContain("simple-form-secret");
  });
});
