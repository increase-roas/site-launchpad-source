import { describe, expect, it, vi } from "vitest";
import {
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnels,
} from "../drizzle/schema";
import { buildSimpleFormStoredRecord } from "../shared/simpleFormConfig";
import { encryptSetupValue } from "./clientSecurity";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getClientAssets: vi.fn(),
  getClientById: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import {
  createSimpleFormFromTemplate,
  getSimpleFormDetail,
  getSimpleFormPublishHandoff,
  saveSimpleFormConfig,
} from "./simpleFormDb";

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
  ghlWebhookUrl: string
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
  const secretRow = {
    funnelId: 11,
    metaCapiAccessTokenEncrypted: encryptSetupValue("meta-token"),
    metaTestEventCodeEncrypted: null,
    ghlWebhookUrlEncrypted: encryptSetupValue(ghlWebhookUrl),
    crmCallbackSecretEncrypted: encryptSetupValue("crm-secret"),
    submissionAlertWebhookUrlEncrypted: null,
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
            if (table === funnelRuntimeSecrets) return [secretRow];
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
  it("uses the decrypted stored GHL URL to prevent false readiness", async () => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord(), "not-a-url")
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
        ?.missing.some(item => item.includes("Canonical Shape A"))
    ).toBe(true);
    expect(JSON.stringify(detail)).not.toContain("not-a-url");
  });

  it("returns validated non-secret configuration separately from secret status", async () => {
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    const ghlWebhookUrl = "https://services.leadconnectorhq.com/hooks/example";
    dbMocks.getDb.mockResolvedValue(
      detailDatabase(buildReadyRecord(), ghlWebhookUrl)
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
    expect(handoff.secretsPresent.GHL_WEBHOOK_URL).toBe(true);
    expect(JSON.stringify(handoff)).not.toContain("meta-token");
    expect(JSON.stringify(handoff)).not.toContain(ghlWebhookUrl);
    expect(JSON.stringify(handoff)).not.toContain("crm-secret");
    expect(JSON.stringify(handoff)).not.toContain("[PRESENT]");
  });
});
