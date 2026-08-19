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
  createBlankPaidFunnel,
  getPaidFunnelDetail,
  importPaidFunnelZip,
  isPaidFunnelRegistryUnavailable,
  listPaidFunnelTemplates,
  savePaidFunnelGraph,
} from "./paidFunnelDb";
import { createGenericPaidFunnelFixture } from "../shared/paidFunnel/fixture";
import { studioToPersistSteps, studioToStorageGraph } from "../shared/paidFunnel/persist";
import {
  addStudioSurveyQuestion,
  createDocumentFromPersist,
  createStudioState,
  deleteStudioSurveyQuestion,
  insertPaletteOnCanvas,
} from "../shared/paidFunnel/store";

type Row = Record<string, unknown> & { id?: number };

function thenable<T>(result: T) {
  const builder = {
    for: async () => result,
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
  let lockedGraphRows = 0;
  const inserted: Array<{ table: unknown; values: Row }> = [];
  const deleted: Array<{ table: unknown; values: Row }> = [];

  const api = {
    inserted,
    deleted,
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
        where: () => {
          const result = tables.get(table) ?? [];
          const builder = thenable(result);
          if (table !== paidFunnelGraphs) return builder;
          return {
            ...builder,
            for: async () => {
              lockedGraphRows += 1;
              return result;
            },
          };
        },
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
    delete: (table: unknown) => ({
      where: async () => {
        const rows = tables.get(table) ?? [];
        const index = table === paidFunnelSteps
          ? rows.findIndex(row => typeof row.key === "string" && /^survey-question-\d+$/.test(row.key))
          : -1;
        if (index < 0) return [];
        const [removed] = rows.splice(index, 1);
        if (removed) deleted.push({ table, values: removed });
        return removed ? [removed] : [];
      },
    }),
    transaction: async (callback: (tx: typeof api) => Promise<unknown>) =>
      callback(api),
    get lockedGraphRows() {
      return lockedGraphRows;
    },
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

  it("lists the generic fixture with only its declared attribution database", async () => {
    const templates = await listPaidFunnelTemplates(5);
    expect(templates[0]?.templateKey).toBe("generic-paid-funnel");
    expect(templates[0]?.resources).toEqual([
      { type: "d1", name: "paid-funnel-events", binding: "FUNNEL_DB" },
    ]);
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

  it("does not leak SQL when creating from template against a missing registry", async () => {
    const missing = Object.assign(
      new Error('relation "paid_funnels" does not exist'),
      { code: "42P01" },
    );
    dbMocks.getDb.mockResolvedValue({
      select: () => {
        throw missing;
      },
    });
    await expect(createPaidFunnelFromTemplate(5, "generic-paid-funnel")).rejects.toThrow(
      "Paid funnel could not be created from the template.",
    );
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
      "survey-homeowner",
      "survey-timeline",
      "form",
      "thankYou",
    ]);
    expect(db.inserted.some(row => row.table === paidFunnelGraphs)).toBe(true);
    expect(
      db.inserted.some(row => row.table === paidFunnelGraphRevisions)
    ).toBe(true);
    expect(JSON.stringify(db.inserted.map(row => row.values))).not.toMatch(
      /EAAB|sk_live|BEGIN RSA/
    );
  });

  it("creates independent generic funnels with unique names and slugs", async () => {
    const first = await createPaidFunnelFromTemplate(5, "generic-paid-funnel");
    const second = await createPaidFunnelFromTemplate(5, "generic-paid-funnel");
    expect(first.alreadyExists).toBe(false);
    expect(second.alreadyExists).toBe(false);
    expect(second.funnelId).not.toBe(first.funnelId);

    const funnels = db.tables.get(paidFunnels) ?? [];
    expect(funnels.map(row => row.name)).toEqual([
      "Northland Spas Paid Funnel",
      "Northland Spas Paid Funnel 2",
    ]);
    expect(funnels.map(row => row.slug)).toEqual([
      "northland-paid-funnel",
      "northland-paid-funnel-2",
    ]);
    const templates = await listPaidFunnelTemplates(5);
    expect(templates[0]?.existingFunnelId).toBeNull();
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
    expect(result.resources).toEqual([
      { type: "d1", name: "paid-funnel-events", binding: "FUNNEL_DB" },
    ]);
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
    expect(db.lockedGraphRows).toBe(1);
    expect(saved.studio!.expectedUpdatedAt.getTime()).toBeGreaterThan(
      detail.studio!.expectedUpdatedAt.getTime()
    );
  });

  it("persists deletion of an added survey while protecting structural steps", async () => {
    const created = await createPaidFunnelFromTemplate(5, "generic-paid-funnel");
    const detail = await getPaidFunnelDetail(5, created.funnelId);
    let state = createStudioState(createDocumentFromPersist({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: detail.studio!.stepId,
      expectedUpdatedAt: detail.studio!.expectedUpdatedAt,
      graph: detail.studio!.graph,
    }));
    state = addStudioSurveyQuestion(state);
    const addedKey = state.stepKey;
    const withAdded = await savePaidFunnelGraph({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: detail.studio!.stepId,
      expectedUpdatedAt: detail.studio!.expectedUpdatedAt,
      graph: studioToStorageGraph(state.document.graph),
      steps: studioToPersistSteps(state.document.graph),
    });
    expect(withAdded.steps.some(step => step.key === addedKey)).toBe(true);

    state = createStudioState(createDocumentFromPersist({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: withAdded.studio!.stepId,
      expectedUpdatedAt: withAdded.studio!.expectedUpdatedAt,
      graph: withAdded.studio!.graph,
    }));
    state = { ...state, stepKey: addedKey };
    state = deleteStudioSurveyQuestion(state);
    const withoutAdded = await savePaidFunnelGraph({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: withAdded.studio!.stepId,
      expectedUpdatedAt: withAdded.studio!.expectedUpdatedAt,
      graph: studioToStorageGraph(state.document.graph),
      steps: studioToPersistSteps(state.document.graph),
    });
    expect(withoutAdded.steps.some(step => step.key === addedKey)).toBe(false);
    expect(db.deleted).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: paidFunnelSteps, values: expect.objectContaining({ key: addedKey }) }),
    ]));

    const protectedGraph = {
      ...state.document.graph,
      steps: state.document.graph.steps.filter(step => step.key !== "form"),
    };
    await expect(savePaidFunnelGraph({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: withoutAdded.studio!.stepId,
      expectedUpdatedAt: withoutAdded.studio!.expectedUpdatedAt,
      graph: studioToStorageGraph(protectedGraph),
      steps: studioToPersistSteps(protectedGraph),
    })).rejects.toThrow("Only custom survey questions can be removed");
  });

  it("creates a blank funnel with an empty canvas, then saves and reloads an edit", async () => {
    const created = await createBlankPaidFunnel(5);
    expect(created.alreadyExists).toBe(false);
    expect(created.funnelId).toBeGreaterThan(0);
    const steps = db.inserted.filter(row => row.table === paidFunnelSteps);
    expect(steps.map(row => row.values.key)).toEqual(["landing"]);
    const funnel = (db.tables.get(paidFunnels) ?? [])[0];
    expect(funnel?.source).toBe("template");
    expect(funnel?.templateVersionId).toBeNull();
    expect(funnel?.name).toBe("Northland Spas Funnel");

    const detail = await getPaidFunnelDetail(5, created.funnelId);
    expect(detail.studio?.graph.steps).toHaveLength(1);
    expect(detail.studio?.graph.pages.landing.sections).toEqual([]);
    expect(detail.studio?.graph.steps.map(step => step.key)).not.toContain("form");

    let state = createStudioState(createDocumentFromPersist({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: detail.studio!.stepId,
      expectedUpdatedAt: detail.studio!.expectedUpdatedAt,
      graph: detail.studio!.graph,
    }));
    state = insertPaletteOnCanvas(state, { source: "section", preset: "cta" });
    expect(state.document.graph.pages.landing.sections).toHaveLength(1);

    const saved = await savePaidFunnelGraph({
      clientId: 5,
      funnelId: created.funnelId,
      stepId: detail.studio!.stepId,
      expectedUpdatedAt: detail.studio!.expectedUpdatedAt,
      graph: studioToStorageGraph(state.document.graph),
      steps: studioToPersistSteps(state.document.graph),
    });
    expect(saved.studio?.graph.pages.landing.sections).toHaveLength(1);

    const reloaded = await getPaidFunnelDetail(5, created.funnelId);
    expect(reloaded.studio?.graph.pages.landing.sections).toHaveLength(1);
    expect(reloaded.studio?.graph.pages.landing.sections[0]?.preset).toBe("cta");
    expect(reloaded.steps.map(step => step.key)).toEqual(["landing"]);
  });
});
