import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  paidFunnelGraphRevisions,
  paidFunnelGraphs,
  paidFunnelSteps,
  paidFunnelTemplateArtifacts,
  paidFunnelTemplateVersions,
  paidFunnelTemplates,
  paidFunnels,
} from "../drizzle/schema";
import { GENERIC_PAID_FUNNEL_PACKAGE } from "../shared/paidFunnelFixture";
import { createStoreZip } from "../shared/paidFunnelZip";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getClientById: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import {
  createPaidFunnelFromTemplate,
  getPaidFunnelDetail,
  importPaidFunnelZip,
  isPaidFunnelRegistryUnavailable,
  listPaidFunnelTemplates,
  savePaidFunnelGraph,
} from "./paidFunnelDb";
import { createGenericPaidFunnelFixture } from "../shared/paidFunnel/fixture";

type Row = Record<string, unknown> & { id?: number };

function thenable<T>(result: T) {
  const builder = {
    limit: async () => result,
    orderBy: () => builder,
    then: (
      resolve: (value: T) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createMemoryDb() {
  const tables = new Map<unknown, Row[]>([
    [paidFunnelTemplates, []],
    [paidFunnelTemplateVersions, []],
    [paidFunnelTemplateArtifacts, []],
    [paidFunnels, []],
    [paidFunnelSteps, []],
    [paidFunnelGraphs, []],
    [paidFunnelGraphRevisions, []],
  ]);
  let nextId = 1;
  const inserted: Array<{ table: unknown; values: Row }> = [];

  const api = {
    inserted,
    tables,
    select: (_shape?: unknown) => ({
      from: (table: unknown) => ({
        leftJoin: () => ({
          where: () =>
            thenable(
              (tables.get(paidFunnelTemplates) ?? []).flatMap(template => {
                const versions = (
                  tables.get(paidFunnelTemplateVersions) ?? []
                ).filter(version => version.templateId === template.id);
                if (versions.length === 0) {
                  return [{ template, version: undefined }];
                }
                return versions.map(version => ({ template, version }));
              })
            ),
        }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => {
                const template = (tables.get(paidFunnelTemplates) ?? [])[0];
                const version = (tables.get(paidFunnelTemplateVersions) ??
                  [])[0];
                return template && version ? [{ template, version }] : [];
              },
            }),
          }),
        }),
        where: () => thenable(tables.get(table) ?? []),
        orderBy: () => thenable(tables.get(table) ?? []),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => {
        const row = {
          ...values,
          id: values.id ?? nextId++,
          updatedAt: values.updatedAt ?? new Date("2026-08-18T12:00:00.000Z"),
        };
        tables.get(table)?.push(row);
        inserted.push({ table, values: row });
        return {
          returning: async () => [{ id: row.id }],
        };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Row) => ({
        where: () => ({
          returning: async () => {
            const rows = tables.get(table) ?? [];
            if (rows[0]) Object.assign(rows[0], values);
            return rows[0] ? [{ id: rows[0].id }] : [];
          },
        }),
      }),
    }),
    transaction: async (callback: (tx: typeof api) => Promise<unknown>) =>
      callback(api),
  };
  return api;
}

describe("paid funnel registry persistence", () => {
  let db: ReturnType<typeof createMemoryDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMemoryDb();
    dbMocks.getDb.mockResolvedValue(db);
    dbMocks.getClientById.mockResolvedValue({
      id: 5,
      businessName: "Northland Spas",
      shortName: "northland",
    });
  });

  it("lists the generic fixture without forcing Cloudflare resources", async () => {
    const templates = await listPaidFunnelTemplates(5);
    expect(templates[0]?.templateKey).toBe("generic-paid-funnel");
    expect(templates[0]?.resources).toEqual([]);
    expect(templates[0]?.requiredRuntimeSecrets).toContain(
      "STAGE_WEBHOOK_SECRET"
    );
    expect(
      (db.tables.get(paidFunnelTemplates) ?? []).some(
        row => row.templateKey === "generic-paid-funnel"
      )
    ).toBe(true);
  });

  it("returns the generic fixture when the registry table is missing", async () => {
    const missing = Object.assign(
      new Error('relation "paid_funnel_templates" does not exist'),
      { code: "42P01" }
    );
    dbMocks.getDb.mockResolvedValue({
      select: () => {
        throw missing;
      },
    });
    const templates = await listPaidFunnelTemplates(5);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.templateKey).toBe("generic-paid-funnel");
    expect(templates[0]?.source).toBe("fixture");
    expect(isPaidFunnelRegistryUnavailable(missing)).toBe(true);
  });

  it("creates the complete generic multi-step fixture funnel", async () => {
    const created = await createPaidFunnelFromTemplate(
      5,
      "generic-paid-funnel"
    );
    expect(created.alreadyExists).toBe(false);
    expect(created.funnelId).toBeGreaterThan(0);
    const steps = db.inserted.filter(row => row.table === paidFunnelSteps);
    expect(steps.map(row => row.values.key)).toEqual([
      "landing",
      "form",
      "thank-you",
      "booking",
      "upsell",
    ]);
    expect(db.inserted.some(row => row.table === paidFunnelGraphs)).toBe(true);
    expect(
      db.inserted.some(row => row.table === paidFunnelGraphRevisions)
    ).toBe(true);
    expect(JSON.stringify(db.inserted.map(row => row.values))).not.toMatch(
      /EAAB|sk_live|BEGIN RSA/
    );
  });

  it("imports a zip as a ready package and never stores secret values", async () => {
    const zip = createStoreZip([
      {
        path: "launchpad.template.json",
        data: Buffer.from(JSON.stringify(GENERIC_PAID_FUNNEL_PACKAGE)),
      },
    ]);
    const result = await importPaidFunnelZip({
      clientId: 5,
      filename: "funnel.zip",
      zipBase64: zip.toString("base64"),
      storageKey: "clients/northland/funnels/funnel.zip",
    });
    expect(result.status).toBe("ready");
    expect(result.templateKey).toBe("generic-paid-funnel");
    expect(result.resources).toEqual([]);
    expect(
      db.inserted.some(row => row.table === paidFunnelTemplateArtifacts)
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/EAAB|sk_live/);
  });

  it("assembles a studio graph and saves builder graphs through saveGraph", async () => {
    const created = await createPaidFunnelFromTemplate(5, "generic-paid-funnel");
    const detail = await getPaidFunnelDetail(5, created.funnelId);
    expect(detail.studio).toBeTruthy();
    expect(detail.studio?.graph.kind).toBe("paid-funnel");
    expect(detail.studio?.graph.pages.landing.kind).toBe("page");
    expect(detail.graphs[0]?.graph.pages[0]?.kind).toBe("page");

    const builder = createGenericPaidFunnelFixture("db-save");
    const saved = await savePaidFunnelGraph({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: detail.studio!.stepId,
      expectedUpdatedAt: detail.studio!.expectedUpdatedAt,
      graph: builder,
    });
    expect(saved.studio?.graph.pages.landing.kind).toBe("page");
    expect(saved.graphs[0]?.graph.version).toBe(1);
  });
});
