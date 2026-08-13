import type { TrpcContext } from "./_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFunnelBuilderCards: vi.fn(),
  createFunnelBuilder: vi.fn(),
  getFunnelBuilderDetail: vi.fn(),
  saveFunnelBuilder: vi.fn(),
  markFunnelReady: vi.fn(),
  markFunnelDeployed: vi.fn(),
  ensureWorkspaceDefaults: vi.fn(),
}));

vi.mock("./funnelConfigDb", () => ({
  listFunnelBuilderCards: mocks.listFunnelBuilderCards,
  createFunnelBuilder: mocks.createFunnelBuilder,
  getFunnelBuilderDetail: mocks.getFunnelBuilderDetail,
  saveFunnelBuilder: mocks.saveFunnelBuilder,
  markFunnelReady: mocks.markFunnelReady,
  markFunnelDeployed: mocks.markFunnelDeployed,
}));
vi.mock("./workspaceDb", () => ({ ensureWorkspaceDefaults: mocks.ensureWorkspaceDefaults }));

import { funnelBuilderRouter } from "./routers/funnelBuilder";

function context(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "funnel-test-user",
      name: "Funnel Test",
      email: "funnel@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const detail = {
  funnel: { id: 8, clientId: 5, name: "Hot Tub Quiz", deploymentStatus: "draft" },
  config: { generatedConfig: "export const funnelConfig = {};" },
  questions: [],
  profile: { businessName: "Paradise Spas", missingSetup: [] },
};

const editorInput = {
  name: "Hot Tub Quiz",
  slug: "hot-tub-quiz",
  serviceArea: "Minot, ND, 58701, United States",
  offerHeadline: "Save on select hot tubs",
  offerSubheadline: "Find the right model.",
  thankYouMessage: "Thanks! We will call shortly.",
  questions: [
    {
      questionText: "What are you interested in?",
      questionType: "radio" as const,
      options: ["Hot Tub", "Swim Spa"],
    },
  ],
};

describe("authenticated funnel builder procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureWorkspaceDefaults.mockResolvedValue(undefined);
    mocks.listFunnelBuilderCards.mockResolvedValue([detail.funnel]);
    mocks.createFunnelBuilder.mockResolvedValue(detail);
    mocks.getFunnelBuilderDetail.mockResolvedValue(detail);
    mocks.saveFunnelBuilder.mockResolvedValue(detail);
    mocks.markFunnelReady.mockResolvedValue({ ...detail, funnel: { ...detail.funnel, deploymentStatus: "ready" } });
    mocks.markFunnelDeployed.mockResolvedValue({ ...detail, funnel: { ...detail.funnel, deploymentStatus: "deployed" } });
  });

  it("lists all funnels after ensuring legacy clients have defaults", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    const result = await caller.list({ clientId: 5 });
    expect(mocks.ensureWorkspaceDefaults).toHaveBeenCalledWith(5);
    expect(result).toHaveLength(1);
  });

  it("creates and retrieves a client-owned funnel", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    await caller.create({ clientId: 5, name: "Hot Tub Quiz" });
    await caller.get({ clientId: 5, funnelId: 8 });
    expect(mocks.createFunnelBuilder).toHaveBeenCalledWith(5, "Hot Tub Quiz");
    expect(mocks.getFunnelBuilderDetail).toHaveBeenCalledWith(5, 8);
  });

  it("saves ordered questions and returns generated configuration", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    const result = await caller.save({ clientId: 5, funnelId: 8, config: editorInput });
    expect(mocks.saveFunnelBuilder).toHaveBeenCalledWith(5, 8, editorInput);
    expect(result.config.generatedConfig).toContain("funnelConfig");
  });

  it("marks a complete funnel ready and returns the exact Wrangler instruction", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    const result = await caller.deploy({ clientId: 5, funnelId: 8 });
    expect(mocks.markFunnelReady).toHaveBeenCalledWith(5, 8);
    expect(result.message).toBe(
      "Funnel config generated. Run `npx wrangler deploy` in the funnel template folder to go live.",
    );
  });

  it("records deployed status after the manual Wrangler confirmation", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    const result = await caller.markDeployed({ clientId: 5, funnelId: 8 });
    expect(mocks.markFunnelDeployed).toHaveBeenCalledWith(5, 8);
    expect(result.funnel.deploymentStatus).toBe("deployed");
  });
});
