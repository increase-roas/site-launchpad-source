import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ASSET_SLOT_VALUES, BUSINESS_DAY_VALUES } from "../shared/client";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";
import { UpdateConflictError } from "./trpcErrors";

const mocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
  getClientAssets: vi.fn(),
  getClientSecretSetup: vi.fn(),
  getClientViewData: vi.fn(),
  updateClient: vi.fn(),
  listClients: vi.fn(),
  listClientAssets: vi.fn(),
  listClientSecretSetups: vi.fn(),
  listClientViewData: vi.fn(),
  createClientWithSecrets: vi.fn(),
  createDraftClient: vi.fn(),
  saveClientSecretSetup: vi.fn(),
}));

const workspaceMocks = vi.hoisted(() => ({
  ensureWorkspaceDefaults: vi.fn(),
  getWorkspace: vi.fn(),
  replaceFunnelShape: vi.fn(),
  saveHomepageSectionOrder: vi.fn(),
  updateFunnelStep: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./workspaceDb", () => workspaceMocks);

import { appRouter } from "./routers";

const baseClient = {
  id: 7,
  businessName: "Paradise Spas",
  shortName: "Paradise",
  phone: "+17015551234",
  email: "hello@paradisespas.example",
  streetAddress: "123 Main Street",
  city: "Minot",
  state: "North Dakota",
  postalCode: "58701",
  country: "United States",
  websiteUrl: "https://paradisespas.example",
  foundedYear: 1994,
  tagline: "Relaxation starts here.",
  theme: "aqua" as const,
  businessHours: BUSINESS_DAY_VALUES.map((day, index) => ({
    day,
    isOpen: index < 6,
    opensAt: "09:00",
    closesAt: "17:00",
  })),
  facebookUrl: "https://www.facebook.com/paradisespas",
  googleMapsUrl: "https://maps.app.goo.gl/example",
  productCategories: ["hotTubs" as const],
  primaryOffer: "Save on select models this month.",
  financingPromise: "Flexible monthly payment options are available.",
  deliveryPromise: "Local delivery and setup are available.",
  status: "draft" as const,
  readyAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const detailsInput = {
  businessName: baseClient.businessName,
  shortName: baseClient.shortName,
  phone: baseClient.phone,
  email: baseClient.email,
  streetAddress: baseClient.streetAddress,
  city: baseClient.city,
  state: baseClient.state,
  postalCode: baseClient.postalCode,
  country: baseClient.country,
  websiteUrl: baseClient.websiteUrl,
  foundedYear: baseClient.foundedYear,
  tagline: baseClient.tagline,
  theme: baseClient.theme,
  businessHours: baseClient.businessHours,
  facebookUrl: baseClient.facebookUrl,
  googleMapsUrl: baseClient.googleMapsUrl,
  productCategories: baseClient.productCategories,
  primaryOffer: baseClient.primaryOffer,
  financingPromise: baseClient.financingPromise,
  deliveryPromise: baseClient.deliveryPromise,
};

const setupInput = {
  metaPixelId: "1234567890",
  ga4MeasurementId: "G-ABC1234",
  clarityId: "clarity123",
  ghlApiKey: "ghl-api-key-value",
  ghlWebhookUrl: "https://services.leadconnectorhq.com/hooks/example",
  cloudflareProjectName: "paradise-spas",
};

function createContext(role: "admin" | "user" | null = "admin"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174002",
            name: "Test User",
            email: "test@example.com",
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

describe("client launch gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    mocks.getClientById.mockResolvedValue(baseClient);
    mocks.getClientAssets.mockResolvedValue([]);
    mocks.getClientSecretSetup.mockResolvedValue(undefined);
    mocks.getClientViewData.mockImplementation(async clientId => {
      const client = await mocks.getClientById(clientId);
      const assets = await mocks.getClientAssets(clientId);
      const secretSetup = await mocks.getClientSecretSetup(clientId);
      return { client, assets, secretSetup };
    });
    mocks.updateClient.mockResolvedValue(undefined);
    mocks.listClients.mockResolvedValue([baseClient]);
    mocks.listClientAssets.mockResolvedValue([]);
    mocks.listClientSecretSetups.mockResolvedValue([]);
    mocks.listClientViewData.mockImplementation(async () => {
      const clients = await mocks.listClients();
      const assets = await mocks.listClientAssets();
      const secretSetups = await mocks.listClientSecretSetups();
      return { clients, assets, secretSetups };
    });
    mocks.createClientWithSecrets.mockResolvedValue(7);
    mocks.createDraftClient.mockResolvedValue(7);
    mocks.saveClientSecretSetup.mockResolvedValue(undefined);
    workspaceMocks.ensureWorkspaceDefaults.mockResolvedValue(undefined);
  });

  it("lists and retrieves persisted clients with readiness details", async () => {
    const caller = appRouter.createCaller(createContext());

    const [list, detail] = await Promise.all([
      caller.clients.list(),
      caller.clients.get({ clientId: 7 }),
    ]);

    expect(list).toHaveLength(1);
    expect(list[0]?.client.id).toBe(7);
    expect(detail.client.businessName).toBe("Paradise Spas");
    expect(detail.readiness.isComplete).toBe(false);
    expect(mocks.listClientViewData).toHaveBeenCalledTimes(1);
    expect(mocks.getClientViewData).toHaveBeenCalledWith(7);
  });

  it("uses one grouped database operation for clients.list with a max-one runtime", async () => {
    let activeReads = 0;
    let maxConcurrentReads = 0;
    const trackRead = async <T>(value: T): Promise<T> => {
      activeReads += 1;
      maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);
      await new Promise(resolve => setTimeout(resolve, 0));
      activeReads -= 1;
      return value;
    };
    mocks.listClients.mockImplementation(() => trackRead([baseClient]));
    mocks.listClientAssets.mockImplementation(() => trackRead([]));
    mocks.listClientSecretSetups.mockImplementation(() => trackRead([]));

    const caller = appRouter.createCaller(createContext());
    await caller.clients.list();

    expect(mocks.listClientViewData).toHaveBeenCalledTimes(1);
    expect(maxConcurrentReads).toBeLessThanOrEqual(1);
  });

  it("classifies clients.list database failures without logging sensitive details", async () => {
    const unsafeDetail =
      "postgresql://private-user:private-password@private-host/database";
    mocks.listClientViewData.mockRejectedValueOnce(
      Object.assign(
        new Error("The database is temporarily unavailable. Please try again."),
        {
          code: "RETRYABLE_DATABASE_ERROR",
          classification: "database_connection",
        },
      ),
    );
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const caller = appRouter.createCaller(createContext());

      await expect(caller.clients.list()).rejects.toThrow(
        "The database is temporarily unavailable. Please try again.",
      );

      expect(logError).toHaveBeenCalledWith(
        "[RuntimeOperation]",
        expect.objectContaining({
          operation: "clients_list_database",
          outcome: "failure",
          classification: "database_connection",
        }),
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain(unsafeDetail);
    } finally {
      logError.mockRestore();
    }
  });

  it("creates a client without redundantly seeding after the transactional create", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.clients.create({ details: detailsInput, setup: setupInput });

    expect(mocks.createClientWithSecrets).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: "Paradise Spas", status: "draft" }),
      expect.objectContaining({
        metaPixelIdEncrypted: expect.stringMatching(/^v[12]\./),
        ghlApiKeyEncrypted: expect.stringMatching(/^v[12]\./),
        ghlWebhookUrlEncrypted: expect.stringMatching(/^v[12]\./),
      }),
    );
    expect(workspaceMocks.ensureWorkspaceDefaults).not.toHaveBeenCalled();
  });

  it("creates a draft client without redundantly seeding after the transactional create", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.clients.createDraft({ businessName: "Northland Spas" });
    expect(mocks.createDraftClient).toHaveBeenCalledWith("Northland Spas");
    expect(workspaceMocks.ensureWorkspaceDefaults).not.toHaveBeenCalled();
  });

  it("updates client details and keeps blank setup fields unchanged", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.clients.update({
      clientId: 7,
      details: { ...detailsInput, tagline: "A new client tagline." },
      setup: {
        metaPixelId: "",
        ga4MeasurementId: "",
        clarityId: "",
        ghlApiKey: "",
        ghlWebhookUrl: "",
        cloudflareProjectName: "",
      },
      expectedUpdatedAt: baseClient.updatedAt,
    });

    expect(mocks.updateClient).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ tagline: "A new client tagline." }),
      baseClient.updatedAt,
    );
    expect(mocks.saveClientSecretSetup).not.toHaveBeenCalled();
  });

  it("refuses to mark an incomplete client ready", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.clients.launch({ clientId: 7 })).rejects.toBeInstanceOf(TRPCError);
    expect(mocks.updateClient).not.toHaveBeenCalled();
  });

  it("marks a complete client ready without deploying anything", async () => {
    let currentClient = { ...baseClient };
    mocks.getClientById.mockImplementation(async () => currentClient);
    mocks.getClientAssets.mockResolvedValue(
      ASSET_SLOT_VALUES.map((slot, index) => ({
        id: index + 1,
        clientId: 7,
        slot,
        storageKey: `clients/7/${slot}.webp`,
        storageUrl: `https://assets.example.com/clients/7/${slot}.webp`,
        filename: `${slot}.webp`,
        originalFilename: `${slot}.jpg`,
        mimeType: "image/webp",
        byteSize: 50_000,
        width: 1200,
        height: 800,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    mocks.getClientSecretSetup.mockResolvedValue({
      id: 1,
      clientId: 7,
      metaPixelIdEncrypted: "v1.a.b.c",
      ga4MeasurementIdEncrypted: "v1.a.b.c",
      clarityIdEncrypted: "v1.a.b.c",
      ghlApiKeyEncrypted: "v1.a.b.c",
      ghlWebhookUrlEncrypted: "v1.a.b.c",
      cloudflareProjectNameEncrypted: "v1.a.b.c",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.updateClient.mockImplementation(async (_clientId, update) => {
      currentClient = { ...currentClient, ...update };
    });

    const caller = appRouter.createCaller(createContext());
    const result = await caller.clients.launch({ clientId: 7 });

    expect(mocks.updateClient).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: "ready", readyAt: expect.any(Date) }),
      baseClient.updatedAt,
    );
    expect(result.client.status).toBe("ready");
    expect(result.readiness.isComplete).toBe(true);
  });

  it("lets a non-admin operator update client details", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await caller.clients.update({
      clientId: 7,
      details: { ...detailsInput, tagline: "Operator edit." },
      setup: {
        metaPixelId: "",
        ga4MeasurementId: "",
        clarityId: "",
        ghlApiKey: "",
        ghlWebhookUrl: "",
        cloudflareProjectName: "",
      },
      expectedUpdatedAt: baseClient.updatedAt,
    });
    expect(mocks.updateClient).toHaveBeenCalled();
  });

  it("returns CONFLICT when expectedUpdatedAt does not match", async () => {
    mocks.updateClient.mockRejectedValue(new UpdateConflictError());
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.clients.update({
        clientId: 7,
        details: detailsInput,
        setup: {
          metaPixelId: "",
          ga4MeasurementId: "",
          clarityId: "",
          ghlApiKey: "",
          ghlWebhookUrl: "",
          cloudflareProjectName: "",
        },
        expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects client updates that omit expectedUpdatedAt", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.clients.update({
        clientId: 7,
        details: detailsInput,
        setup: {
          metaPixelId: "",
          ga4MeasurementId: "",
          clarityId: "",
          ghlApiKey: "",
          ghlWebhookUrl: "",
          cloudflareProjectName: "",
        },
      } as never),
    ).rejects.toBeTruthy();
    expect(mocks.updateClient).not.toHaveBeenCalled();
  });

  it("forbids a non-admin from launching", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.clients.launch({ clientId: 7 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
    expect(mocks.updateClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated client lists", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.clients.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });
});
