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
  startPublish: vi.fn(),
  advancePublish: vi.fn(),
  publishStatus: vi.fn(),
}));

vi.mock("./paidFunnelDb", () => mocks);
vi.mock("./publisher/publishGenericPaidFunnel", () => ({
  startPublish: mocks.startPublish,
  advancePublish: mocks.advancePublish,
  publishStatus: mocks.publishStatus,
}));

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
    const publish = {
      id: "11111111-1111-4111-8111-111111111111",
      funnelId: 21,
      status: "pending",
      step: "create_repository",
      progress: { completed: 0, total: 7 },
      error: null,
    };
    mocks.startPublish.mockResolvedValue(publish);
    mocks.advancePublish.mockResolvedValue({ ...publish, status: "failed" });
    mocks.publishStatus.mockResolvedValue(publish);
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

  it("maps createFromTemplate connection failures to a public 500 without SQL", async () => {
    mocks.createPaidFunnelFromTemplate.mockRejectedValueOnce(
      Object.assign(
        new Error('Failed query: insert into paid_funnels ("slug") values ($1)'),
        {
          cause: Object.assign(new Error("CONNECTION_CLOSED"), {
            code: "CONNECTION_CLOSED",
          }),
        },
      ),
    );
    const caller = paidFunnelRouter.createCaller(context());
    await expect(
      caller.createFromTemplate({
        clientId: 5,
        templateKey: "generic-paid-funnel",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "The database is temporarily unavailable. Please try again.",
    });
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
      steps: graph.steps.map((step, position) => ({
        key: step.key,
        stepType: step.type,
        slug: step.slug,
        title: step.title,
        seo: step.seo,
        nextStep: step.nextStep.type === "step" ? step.nextStep.stepKey : null,
        previewState: step.previewState,
        publishState: step.publishState,
        position,
      })),
    });
    expect(mocks.savePaidFunnelGraph).toHaveBeenCalledOnce();
    const payload = mocks.savePaidFunnelGraph.mock.calls[0][0];
    expect(payload.graph.version).toBe(1);
    expect(payload.graph.pages[0].kind).toBe("page");
    expect(payload.graph.pages[0].sections[0].kind).toBe("section");
  });

  it("owns start, advance, Retry, and status by client plus funnel", async () => {
    const caller = paidFunnelRouter.createCaller(context());
    await caller.startPublish({ clientId: 5, funnelId: 21 });
    await caller.advancePublish({ clientId: 5, funnelId: 21 });
    await caller.advancePublish({ clientId: 5, funnelId: 21, retryFailed: true });
    await caller.publishStatus({ clientId: 5, funnelId: 21 });
    expect(mocks.startPublish).toHaveBeenCalledWith(5, 21);
    expect(mocks.advancePublish).toHaveBeenNthCalledWith(1, 5, 21, false);
    expect(mocks.advancePublish).toHaveBeenNthCalledWith(2, 5, 21, true);
    expect(mocks.publishStatus).toHaveBeenCalledWith(5, 21);
  });

  it("rejects unauthenticated registry reads", async () => {
    const caller = paidFunnelRouter.createCaller(context(null));
    await expect(caller.listTemplates({ clientId: 5 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });
});
