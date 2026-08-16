import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";

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

function context(role: "admin" | "user" | null = "admin"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174001",
            name: "Funnel Test",
            email: "funnel@example.com",
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

const detail = {
  funnel: { id: 8, clientId: 5, name: "Hot Tub Quiz", deploymentStatus: "draft" },
  config: {
    serviceArea: "Minot, ND",
    offerHeadline: "Save",
    offerSubheadline: "Find a model",
    thankYouMessage: "Thanks",
    generatedConfig: "export const funnelConfig = { pixel: '1234567890' };",
    generatedAt: null,
  },
  questions: [],
  profile: {
    businessName: "Paradise Spas",
    phone: "+17015551234",
    serviceArea: "Minot, ND",
    metaPixelId: "1234567890",
    ghlWebhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    missingSetup: [],
  },
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

  it("saves ordered questions without returning generated source", async () => {
    const caller = funnelBuilderRouter.createCaller(context());
    const result = await caller.save({ clientId: 5, funnelId: 8, config: editorInput });
    expect(mocks.saveFunnelBuilder).toHaveBeenCalledWith(5, 8, editorInput);
    expect(result.config.generatedConfig).toBe("");
    expect(result.config.hasGeneratedConfig).toBe(true);
    expect(JSON.stringify(result)).not.toContain("funnelConfig");
    expect(JSON.stringify(result)).not.toContain("1234567890");
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

  it("redacts pixel, webhook, and generated config on get", async () => {
    const caller = funnelBuilderRouter.createCaller(context("user"));
    const result = await caller.get({ clientId: 5, funnelId: 8 });
    const serialized = JSON.stringify(result);
    expect(result.profile.hasMetaPixelId).toBe(true);
    expect(result.config.hasGeneratedConfig).toBe(true);
    expect(result.config.generatedConfig).toBe("");
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("leadconnectorhq");
  });

  it("lets an operator save funnel content", async () => {
    const caller = funnelBuilderRouter.createCaller(context("user"));
    await caller.save({ clientId: 5, funnelId: 8, config: editorInput });
    expect(mocks.saveFunnelBuilder).toHaveBeenCalledWith(5, 8, editorInput);
  });

  it("exports generated funnel config through a dedicated authenticated RPC", async () => {
    const caller = funnelBuilderRouter.createCaller(context("user"));
    const exported = await caller.exportGeneratedConfig({ clientId: 5, funnelId: 8 });
    expect(mocks.getFunnelBuilderDetail).toHaveBeenCalledWith(5, 8);
    expect(exported).toEqual({
      fileName: "funnel.config.ts",
      contents: detail.config.generatedConfig,
    });
  });

  it("rejects unauthenticated generated-config exports", async () => {
    const caller = funnelBuilderRouter.createCaller(context(null));
    await expect(caller.exportGeneratedConfig({ clientId: 5, funnelId: 8 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
    expect(mocks.getFunnelBuilderDetail).not.toHaveBeenCalled();
  });

  it("forbids a non-admin from deploying", async () => {
    const caller = funnelBuilderRouter.createCaller(context("user"));
    await expect(caller.deploy({ clientId: 5, funnelId: 8 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
    expect(mocks.markFunnelReady).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated funnel reads", async () => {
    const caller = funnelBuilderRouter.createCaller(context(null));
    await expect(caller.get({ clientId: 5, funnelId: 8 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });
});
