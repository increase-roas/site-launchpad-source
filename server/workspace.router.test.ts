import type { TrpcContext } from "./_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceMocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  replaceFunnelShape: vi.fn(),
  updateFunnelStep: vi.fn(),
  saveHomepageSectionOrder: vi.fn(),
}));

const clientMocks = vi.hoisted(() => ({ getClientView: vi.fn() }));

vi.mock("./workspaceDb", () => workspaceMocks);
vi.mock("./routers/clients", () => clientMocks);

import { workspaceRouter } from "./routers/workspace";

function context(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "workspace-test-user",
      name: "Workspace Test",
      email: "workspace@example.com",
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

const clientView = {
  client: { id: 5, businessName: "Client Five" },
  assets: [{ id: 1, slot: "logo" }],
  secretStatus: { metaPixelId: true },
  readiness: { percent: 60, isComplete: false },
};

const workspaceView = {
  pages: [{ id: 1, pageType: "homepage" }],
  funnels: [{ id: 3, shape: "B", steps: [{ id: 9, stepType: "zip" }] }],
  sections: [{ id: 11, sectionType: "hero", position: 0, enabled: 1 }],
};

describe("complete selected-client workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMocks.getClientView.mockResolvedValue(clientView);
    workspaceMocks.getWorkspace.mockResolvedValue(workspaceView);
    workspaceMocks.replaceFunnelShape.mockResolvedValue(undefined);
    workspaceMocks.updateFunnelStep.mockResolvedValue(undefined);
    workspaceMocks.saveHomepageSectionOrder.mockResolvedValue(undefined);
  });

  it("returns client config, media, readiness, setup status, pages, funnels, and sections together", async () => {
    const caller = workspaceRouter.createCaller(context());
    const result = await caller.get({ clientId: 5 });

    expect(result).toMatchObject({
      client: { id: 5, businessName: "Client Five" },
      assets: [{ id: 1, slot: "logo" }],
      secretStatus: { metaPixelId: true },
      readiness: { percent: 60, isComplete: false },
      pages: [{ id: 1, pageType: "homepage" }],
      funnels: [{ id: 3, shape: "B" }],
      sections: [{ id: 11, sectionType: "hero" }],
    });
  });

  it("changes a funnel shape and reloads the same selected client", async () => {
    const caller = workspaceRouter.createCaller(context());
    await caller.setFunnelShape({ clientId: 5, funnelId: 3, shape: "C" });
    expect(workspaceMocks.replaceFunnelShape).toHaveBeenCalledWith(5, 3, "C");
    expect(clientMocks.getClientView).toHaveBeenCalledWith(5);
  });

  it("updates step details for the selected client", async () => {
    const caller = workspaceRouter.createCaller(context());
    const step = {
      stepId: 9,
      title: "Contact",
      path: "/qualified-lead/contact",
      capturedFields: ["Name", "Email", "Phone"],
      trackingActions: ["ContactSubmitted"],
    };
    await caller.updateStep({ clientId: 5, step });
    expect(workspaceMocks.updateFunnelStep).toHaveBeenCalledWith(5, step);
  });

  it("saves ordered and enabled homepage sections for the selected client", async () => {
    const caller = workspaceRouter.createCaller(context());
    const sectionTypes = [
      "hero",
      "categories",
      "visitShowroom",
      "deliveryInstall",
      "testimonials",
      "financing",
      "faq",
      "contact",
      "map",
    ] as const;
    const sections = sectionTypes.map((sectionType, index) => ({
      id: index + 1,
      sectionType,
      enabled: sectionType !== "testimonials",
    }));
    await caller.saveSections({ clientId: 5, sections });
    expect(workspaceMocks.saveHomepageSectionOrder).toHaveBeenCalledWith(5, sections);
  });
});
