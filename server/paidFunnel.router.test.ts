import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { GENERIC_PAID_FUNNEL_PACKAGE } from "../shared/paidFunnelFixture";
import { createGenericPaidFunnelFixture } from "../shared/paidFunnel/fixture";

const mocks = vi.hoisted(() => ({
  listPaidFunnelTemplates: vi.fn(),
  importPaidFunnelZip: vi.fn(),
  createPaidFunnelFromTemplate: vi.fn(),
  listPaidFunnels: vi.fn(),
  getPaidFunnelDetail: vi.fn(),
  savePaidFunnelGraph: vi.fn(),
  listReusableSections: vi.fn(),
  saveReusableSection: vi.fn(),
}));

vi.mock("./paidFunnelDb", () => mocks);

import { paidFunnelRouter } from "./routers/paidFunnel";

function context(role: "admin" | "user" | null = "user"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174009",
            name: "Operator",
            email: "operator@example.com",
            loginMethod: "manus",
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("paid funnel registry procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPaidFunnelTemplates.mockResolvedValue([
      {
        templateKey: "generic-paid-funnel",
        name: "Generic Multi-Step Paid Funnel",
        resources: [],
        requiredRuntimeSecrets: ["STAGE_WEBHOOK_SECRET"],
      },
    ]);
    mocks.createPaidFunnelFromTemplate.mockResolvedValue({
      alreadyExists: false,
      funnelId: 21,
    });
    mocks.importPaidFunnelZip.mockResolvedValue({
      status: "draft",
      unsupportedRegions: [
        {
          path: "index.html",
          reason: "iframe is an unsupported region.",
        },
      ],
      templateKey: "imported-paid-funnel",
      versionId: 3,
    });
    mocks.listPaidFunnels.mockResolvedValue([
      { id: 21, name: "Northland Paid Funnel" },
    ]);
    mocks.getPaidFunnelDetail.mockResolvedValue({
      funnel: { id: 21, clientId: 5, name: "Northland Paid Funnel" },
      steps: GENERIC_PAID_FUNNEL_PACKAGE.steps,
      graphs: [],
    });
    mocks.savePaidFunnelGraph.mockResolvedValue({
      funnel: { id: 21 },
      steps: [],
      graphs: [],
    });
    mocks.listReusableSections.mockResolvedValue([]);
    mocks.saveReusableSection.mockResolvedValue({
      id: 9,
      name: "Hero",
      section: { id: "section-hero", preset: "hero", rows: [] },
    });
  });

  it("lists the generic paid-funnel fixture", async () => {
    const caller = paidFunnelRouter.createCaller(context());
    const templates = await caller.listTemplates({ clientId: 5 });
    expect(templates[0]?.templateKey).toBe("generic-paid-funnel");
    expect(templates[0]?.resources).toEqual([]);
  });

  it("creates a funnel from the generic fixture", async () => {
    const caller = paidFunnelRouter.createCaller(context());
    const created = await caller.createFromTemplate({
      clientId: 5,
      templateKey: "generic-paid-funnel",
    });
    expect(created).toEqual({ alreadyExists: false, funnelId: 21 });
  });

  it("imports zip intake and returns exact unsupported-region errors", async () => {
    const caller = paidFunnelRouter.createCaller(context());
    const result = await caller.importZip({
      clientId: 5,
      filename: "site.zip",
      zipBase64: "UEsDBBQAAAA=",
    });
    expect(result.status).toBe("draft");
    expect(result.unsupportedRegions).toEqual([
      { path: "index.html", reason: "iframe is an unsupported region." },
    ]);
  });

  it("accepts a builder graph on saveGraph", async () => {
    const caller = paidFunnelRouter.createCaller(context());
    const graph = createGenericPaidFunnelFixture("router-save");
    await caller.saveGraph({
      clientId: 5,
      funnelId: 21,
      stepId: 3,
      expectedUpdatedAt: new Date("2026-08-18T12:00:00.000Z"),
      graph,
    });
    expect(mocks.savePaidFunnelGraph).toHaveBeenCalledOnce();
    const payload = mocks.savePaidFunnelGraph.mock.calls[0][0];
    expect(payload.graph.version).toBe(1);
    expect(payload.graph.pages[0].kind).toBe("page");
    expect(payload.graph.pages[0].sections[0].kind).toBe("section");
  });

  it("rejects unauthenticated registry reads", async () => {
    const caller = paidFunnelRouter.createCaller(context(null));
    await expect(caller.listTemplates({ clientId: 5 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });
});
