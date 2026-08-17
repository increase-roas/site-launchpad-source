import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { buildSimpleFormStoredRecord } from "../shared/simpleFormConfig";
import { SIMPLE_FORM_SECRET_GUIDES } from "../shared/simpleFormContract";

const mocks = vi.hoisted(() => ({
  listApprovedFunnelTemplates: vi.fn(),
  createSimpleFormFromTemplate: vi.fn(),
  getSimpleFormDetail: vi.fn(),
  saveSimpleFormConfig: vi.fn(),
  saveSimpleFormSecrets: vi.fn(),
  revealCrmCallbackSecret: vi.fn(),
  getSimpleFormPublishHandoff: vi.fn(),
}));

vi.mock("./simpleFormDb", () => mocks);

const publishMocks = vi.hoisted(() => ({
  startPublish: vi.fn(),
  advancePublish: vi.fn(),
  publishStatus: vi.fn(),
}));

vi.mock("./publisher/publishSimpleForm", () => publishMocks);

import { simpleFormRouter } from "./routers/simpleForm";

function context(role: "admin" | "user" | null = "user"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174004",
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

const record = buildSimpleFormStoredRecord({
  businessName: "Northland Spas",
  slug: "northland-spas-simple-form",
});

const detail = {
  funnel: {
    id: 11,
    clientId: 5,
    name: "Northland Spas Simple Form Funnel",
    slug: "northland-spas-simple-form",
    templateKey: "simple-form",
    templateRepo: "increase-roas/paid-funnel-simple-form-funnel",
    contractVersion: 1,
    shape: "A",
    deploymentStatus: "draft",
    status: "draft",
  },
  record,
  config: record.config,
  imageSources: record.imageSources,
  assets: [],
  secretStatus: {
    META_CAPI_ACCESS_TOKEN: false,
    META_TEST_EVENT_CODE: false,
    GHL_WEBHOOK_URL: false,
    CRM_CALLBACK_SECRET: true,
    SUBMISSION_ALERT_WEBHOOK_URL: false,
  },
  secretGuides: SIMPLE_FORM_SECRET_GUIDES,
  readiness: {
    sections: [],
    configurationReady: false,
    published: false,
  },
  template: {
    templateKey: "simple-form",
    previewImageUrl: "/templates/simple-form-preview.svg",
  },
};

describe("simple form template procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listApprovedFunnelTemplates.mockResolvedValue([
      {
        templateKey: "simple-form",
        name: "Simple Form Funnel",
        existingFunnelId: null,
        previewImageUrl: "/templates/simple-form-preview.svg",
        flow: "ZIP → Contact → Thank You",
        inventory: "5 Inventory Slots",
      },
    ]);
    mocks.createSimpleFormFromTemplate.mockResolvedValue({
      alreadyExists: false,
      funnelId: 11,
    });
    mocks.getSimpleFormDetail.mockResolvedValue(detail);
    mocks.saveSimpleFormConfig.mockResolvedValue(detail);
    mocks.saveSimpleFormSecrets.mockResolvedValue(detail);
    mocks.revealCrmCallbackSecret.mockResolvedValue({
      runtimeKey: "CRM_CALLBACK_SECRET",
      value: "generated-secret",
    });
    mocks.getSimpleFormPublishHandoff.mockResolvedValue({
      published: false,
      configurationReady: false,
      secretsPresent: detail.secretStatus,
      validatedConfiguration: null,
    });
    publishMocks.startPublish.mockResolvedValue({
      id: "publish-11",
      status: "pending",
      step: "create_repository",
      progress: { completed: 0, total: 9 },
      error: null,
      repositoryUrl: null,
      liveUrl: null,
    });
    publishMocks.advancePublish.mockResolvedValue({
      id: "publish-11",
      status: "pending",
      step: "ensure_kv_namespace",
      progress: { completed: 1, total: 9 },
      error: null,
      repositoryUrl:
        "https://github.com/launchpad-sites/simple-form-northland-11",
      liveUrl: null,
    });
    publishMocks.publishStatus.mockResolvedValue(null);
  });

  it("lists the approved Simple Form template", async () => {
    const caller = simpleFormRouter.createCaller(context());
    const templates = await caller.listTemplates({ clientId: 5 });
    expect(templates[0]?.templateKey).toBe("simple-form");
    expect(templates[0]?.existingFunnelId).toBeNull();
  });

  it("creates from template and returns alreadyExists on a second create", async () => {
    const caller = simpleFormRouter.createCaller(context());
    const created = await caller.createFromTemplate({
      clientId: 5,
      templateKey: "simple-form",
    });
    expect(created).toEqual({ alreadyExists: false, funnelId: 11 });
    mocks.createSimpleFormFromTemplate.mockResolvedValue({
      alreadyExists: true,
      funnelId: 11,
    });
    const duplicate = await caller.createFromTemplate({
      clientId: 5,
      templateKey: "simple-form",
    });
    expect(duplicate.alreadyExists).toBe(true);
    expect(duplicate.funnelId).toBe(11);
  });

  it("does not include decrypted secrets on get", async () => {
    const caller = simpleFormRouter.createCaller(context());
    const result = await caller.get({ clientId: 5, funnelId: 11 });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("generated-secret");
    expect(result.secretStatus.CRM_CALLBACK_SECRET).toBe(true);
    expect(
      result.secretGuides.some(
        guide => guide.runtimeKey === "META_CAPI_ACCESS_TOKEN"
      )
    ).toBe(true);
  });

  it("keeps publish handoff unpublished and secret-free", async () => {
    const caller = simpleFormRouter.createCaller(context());
    const handoff = await caller.publishHandoff({ clientId: 5, funnelId: 11 });
    expect(handoff.published).toBe(false);
    expect(JSON.stringify(handoff)).not.toContain("generated-secret");
  });

  it("starts and advances publishing only through mutations", async () => {
    const caller = simpleFormRouter.createCaller(context());

    await caller.startPublish({ clientId: 5, funnelId: 11 });
    await caller.advancePublish({ clientId: 5, funnelId: 11 });

    expect(publishMocks.startPublish).toHaveBeenCalledWith(5, 11);
    expect(publishMocks.advancePublish).toHaveBeenCalledWith(5, 11);
  });

  it("keeps concurrent publish-status polls read-only", async () => {
    const caller = simpleFormRouter.createCaller(context());

    await Promise.all([
      caller.publishStatus({ clientId: 5, funnelId: 11 }),
      caller.publishStatus({ clientId: 5, funnelId: 11 }),
      caller.publishStatus({ clientId: 5, funnelId: 11 }),
    ]);

    expect(publishMocks.publishStatus).toHaveBeenCalledTimes(3);
    expect(publishMocks.advancePublish).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated template listing", async () => {
    const caller = simpleFormRouter.createCaller(context(null));
    await expect(caller.listTemplates({ clientId: 5 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });
});
