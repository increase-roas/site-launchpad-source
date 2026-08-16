import type { TrpcContext } from "./_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAstroConfig } from "../shared/astroConfig";
import { BUSINESS_DAY_VALUES } from "../shared/client";
import { UNAUTHED_ERR_MSG } from "../shared/const";

const mocks = vi.hoisted(() => ({
  getAstroConfigView: vi.fn(),
  saveAstroConfig: vi.fn(),
  saveWranglerSecrets: vi.fn(),
}));

vi.mock("./astroConfigDb", () => ({
  getAstroConfigView: mocks.getAstroConfigView,
  saveAstroConfig: mocks.saveAstroConfig,
  saveWranglerSecrets: mocks.saveWranglerSecrets,
}));
import { astroConfigRouter } from "./routers/astroConfig";

function context(role: "admin" | "user" | null = "admin"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174003",
            name: "Astro Test",
            email: "astro@example.com",
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

const config = createDefaultAstroConfig({
  businessName: "Test Spas",
  shortName: "test-spas",
  foundedYear: 1994,
  tagline: "Relax better",
  websiteUrl: "https://test.example.com",
  phone: "+17015551234",
  email: "hello@test.example.com",
  streetAddress: "1 Main Street",
  city: "Minot",
  state: "ND",
  postalCode: "58701",
  country: "US",
  businessHours: BUSINESS_DAY_VALUES.map(day => ({ day, isOpen: false, opensAt: "", closesAt: "" })),
  facebookUrl: "",
  theme: "mono",
});

const view = {
  clientId: 5,
  input: config,
  assets: [],
  secretStatus: {
    GHL_API_KEY: false,
    GHL_LOCATION_ID: false,
    META_PIXEL_ID: false,
    META_CAPI_ACCESS_TOKEN: false,
    META_VALUE_QUALIFIED: false,
    META_VALUE_SCHEDULE: false,
    META_VALUE_SHOWED: false,
    STAGE_WEBHOOK_SECRET: false,
    GOOGLE_SHEETS_ID: false,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: false,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: false,
    ALERT_WEBHOOK_URL: false,
    ADMIN_PASSWORD: false,
    ADMIN_SESSION_SECRET: false,
  },
  generatedConfig: "export const clientConfig = { pixel: 'raw-secret-pixel' } as const;",
  generatedAt: null,
};

describe("authenticated Astro config procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAstroConfigView.mockResolvedValue(view);
    mocks.saveAstroConfig.mockResolvedValue(view);
    mocks.saveWranglerSecrets.mockResolvedValue({ ...view, secretStatus: { ...view.secretStatus, GHL_API_KEY: true } });
  });

  it("loads and saves the complete selected-client configuration", async () => {
    const caller = astroConfigRouter.createCaller(context());
    const loaded = await caller.get({ clientId: 5 });
    expect(loaded.generatedConfig).toBe("");
    expect(loaded.hasGeneratedConfig).toBe(true);
    expect(JSON.stringify(loaded)).not.toContain("raw-secret-pixel");
    const saved = await caller.save({ clientId: 5, config });
    expect(mocks.getAstroConfigView).toHaveBeenCalledWith(5);
    expect(mocks.saveAstroConfig).toHaveBeenCalledWith(5, config);
    expect(saved.generatedConfig).toBe("");
    expect(saved.hasGeneratedConfig).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("raw-secret-pixel");
    expect(JSON.stringify(saved)).not.toContain("clientConfig");
  });

  it("passes reordered navigation and homepage sections through the save API unchanged", async () => {
    const caller = astroConfigRouter.createCaller(context());
    const reordered = {
      ...config,
      navigationItems: [...config.navigationItems].reverse(),
      homepageSections: [...config.homepageSections].reverse(),
    };
    await caller.save({ clientId: 5, config: reordered });
    const savedInput = mocks.saveAstroConfig.mock.calls[0]?.[1];
    expect(savedInput.navigationItems.map((item: { id: string }) => item.id)).toEqual(
      reordered.navigationItems.map(item => item.id),
    );
    expect(savedInput.homepageSections.map((section: { id: string }) => section.id)).toEqual(
      reordered.homepageSections.map(section => section.id),
    );
  });

  it("saves entered secrets without returning their raw values", async () => {
    const caller = astroConfigRouter.createCaller(context());
    const result = await caller.saveSecrets({ clientId: 5, values: { GHL_API_KEY: "raw-secret" } });
    expect(mocks.saveWranglerSecrets).toHaveBeenCalledWith(5, { GHL_API_KEY: "raw-secret" });
    expect(result.secretStatus.GHL_API_KEY).toBe(true);
    expect(JSON.stringify(result)).not.toContain("raw-secret");
    expect(result.generatedConfig).toBe("");
  });

  it("exports generated Astro config through a dedicated authenticated RPC", async () => {
    const caller = astroConfigRouter.createCaller(context("user"));
    const exported = await caller.exportGeneratedConfig({ clientId: 5 });
    expect(mocks.getAstroConfigView).toHaveBeenCalledWith(5);
    expect(exported).toEqual({
      fileName: "client.config.ts",
      contents: view.generatedConfig,
    });
  });

  it("rejects unauthenticated generated-config exports", async () => {
    const caller = astroConfigRouter.createCaller(context(null));
    await expect(caller.exportGeneratedConfig({ clientId: 5 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
    expect(mocks.getAstroConfigView).not.toHaveBeenCalled();
  });

  it("maps missing-client errors to NOT_FOUND", async () => {
    mocks.getAstroConfigView.mockRejectedValue(new Error("Client not found."));
    const caller = astroConfigRouter.createCaller(context());
    await expect(caller.get({ clientId: 99 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Client not found.",
    });
  });
});
