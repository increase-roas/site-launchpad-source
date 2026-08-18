import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { emptySecretPresence } from "../shared/clientIntegrationProfile";

const dbMocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
}));

const integrationMocks = vi.hoisted(() => ({
  loadOrBackfillResolvedClientIntegrationProfile: vi.fn(),
  saveClientIntegrationProfile: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./clientIntegrations", () => integrationMocks);

import { clientsRouter } from "./routers/clients";

const updatedAt = new Date("2026-08-18T16:00:00.000Z");
const dto = {
  clientId: 7,
  identifiers: {
    GHL_LOCATION_ID: "location-1",
    GOOGLE_SHEETS_ID: null,
    META_PIXEL_ID: null,
  },
  secretPresence: {
    ...emptySecretPresence(),
    GHL_API_KEY: "SET" as const,
  },
  groups: [],
  readiness: {
    websiteReady: false,
    funnelReady: false,
    missingWebsiteKeys: ["GOOGLE_SHEETS_ID"],
    missingFunnelKeys: ["GOOGLE_SHEETS_ID"],
  },
  lastUpdated: updatedAt,
  reconciliationStatus: "ready" as const,
  conflictedKeys: [],
};

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      authUserId: "123e4567-e89b-12d3-a456-426614174002",
      name: "Operator",
      email: "operator@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: updatedAt,
      updatedAt,
      lastSignedIn: updatedAt,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("client integration profile router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getClientById.mockResolvedValue({ id: 7 });
    integrationMocks.loadOrBackfillResolvedClientIntegrationProfile.mockResolvedValue({ dto });
    integrationMocks.saveClientIntegrationProfile.mockResolvedValue(dto);
  });

  it("loads the backfilled canonical profile", async () => {
    const caller = clientsRouter.createCaller(createContext());
    const result = await caller.getIntegrationProfile({ clientId: 7 });

    expect(result).toEqual(dto);
    expect(
      integrationMocks.loadOrBackfillResolvedClientIntegrationProfile,
    ).toHaveBeenCalledWith(7);
  });

  it("saves only canonical identifiers and write-only secret replacements", async () => {
    const caller = clientsRouter.createCaller(createContext());
    const result = await caller.saveIntegrationProfile({
      clientId: 7,
      expectedUpdatedAt: updatedAt,
      identifiers: {
        GHL_LOCATION_ID: "location-2",
        GOOGLE_SHEETS_ID: null,
        META_PIXEL_ID: "123456789012345",
      },
      replaceSecrets: {
        GHL_API_KEY: "replacement-secret",
      },
      rotateStageWebhookSecret: true,
      clearSecrets: ["ALERT_WEBHOOK_URL"],
    });

    expect(result).toEqual(dto);
    expect(integrationMocks.saveClientIntegrationProfile).toHaveBeenCalledWith(
      7,
      {
        expectedUpdatedAt: updatedAt,
        identifiers: {
          GHL_LOCATION_ID: "location-2",
          GOOGLE_SHEETS_ID: null,
          META_PIXEL_ID: "123456789012345",
        },
        replaceSecrets: { GHL_API_KEY: "replacement-secret" },
        rotateStageWebhookSecret: true,
        clearSecrets: ["ALERT_WEBHOOK_URL"],
        resolveConflictedKeys: [
          "GHL_LOCATION_ID",
          "GOOGLE_SHEETS_ID",
          "META_PIXEL_ID",
          "GHL_API_KEY",
          "ALERT_WEBHOOK_URL",
          "STAGE_WEBHOOK_SECRET",
        ],
      },
    );
    expect(JSON.stringify(result)).not.toContain("replacement-secret");
  });

  it("rejects invented integration keys", async () => {
    const caller = clientsRouter.createCaller(createContext());
    await expect(
      caller.saveIntegrationProfile({
        clientId: 7,
        expectedUpdatedAt: updatedAt,
        identifiers: {
          GHL_LOCATION_ID: "location-2",
          GOOGLE_SHEETS_ID: null,
          META_PIXEL_ID: null,
        },
        replaceSecrets: {
          INVENTED_SECRET: "nope",
        } as never,
      }),
    ).rejects.toThrow();
    expect(integrationMocks.saveClientIntegrationProfile).not.toHaveBeenCalled();
  });

  it("rejects invalid identifiers and contradictory secret operations", async () => {
    const caller = clientsRouter.createCaller(createContext());
    await expect(
      caller.saveIntegrationProfile({
        clientId: 7,
        expectedUpdatedAt: updatedAt,
        identifiers: {
          GHL_LOCATION_ID: "location-2",
          GOOGLE_SHEETS_ID: null,
          META_PIXEL_ID: "not-a-pixel",
        },
        replaceSecrets: {},
      }),
    ).rejects.toThrow(/Meta Pixel ID/);

    await expect(
      caller.saveIntegrationProfile({
        clientId: 7,
        expectedUpdatedAt: updatedAt,
        identifiers: {
          GHL_LOCATION_ID: "location-2",
          GOOGLE_SHEETS_ID: null,
          META_PIXEL_ID: "123456789012345",
        },
        replaceSecrets: { GHL_API_KEY: "replacement" },
        clearSecrets: ["GHL_API_KEY"],
      }),
    ).rejects.toThrow(/cannot be replaced and cleared/);
    expect(integrationMocks.saveClientIntegrationProfile).not.toHaveBeenCalled();
  });
});
