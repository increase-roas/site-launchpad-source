import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

const originalSecret = process.env.JWT_SECRET;
const originalDedicated = process.env.SECRETS_ENCRYPTION_KEY;

process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
process.env.SECRETS_ENCRYPTION_KEY = "dedicated-test-encryption-key";
process.env.NODE_ENV = "test";

import { getClientIntegrationProfile, loadResolvedPaidFunnelProfile } from "./clientIntegrations";

describe("ClientIntegrationProfile database reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = originalSecret ? originalSecret : "test-only-secret-that-is-long-enough";
    process.env.SECRETS_ENCRYPTION_KEY =
      originalDedicated ? originalDedicated : "dedicated-test-encryption-key";
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough";
    process.env.SECRETS_ENCRYPTION_KEY = "dedicated-test-encryption-key";
    process.env.NODE_ENV = "test";
  });

  it("returns one empty SET/NOT SET profile when the table is missing", async () => {
    dbMocks.getDb.mockResolvedValue({
      select: () => {
        throw Object.assign(
          new Error('Failed query: select "clientId" from client_integration_profiles'),
          {
            cause: Object.assign(
              new Error('relation "client_integration_profiles" does not exist'),
              { code: "42P01" },
            ),
          },
        );
      },
    });

    const dto = await getClientIntegrationProfile(7);
    expect(dto.clientId).toBe(7);
    expect(dto.secretPresence.GHL_API_KEY).toBe("NOT SET");
    expect(dto.readiness.websiteReady).toBe(false);
    expect(dto.readiness.funnelReady).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("Failed query");
    expect(JSON.stringify(dto)).not.toContain("client_integration_profiles");
  });

  it("treats a missing profile table as not SET for publish resolution", async () => {
    dbMocks.getDb.mockResolvedValue({
      select: () => {
        throw Object.assign(
          new Error('Failed query: select "clientId" from client_integration_profiles'),
          {
            cause: Object.assign(
              new Error('relation "client_integration_profiles" does not exist'),
              { code: "42P01" },
            ),
          },
        );
      },
    });

    const resolved = await loadResolvedPaidFunnelProfile(7);
    expect(resolved).toBeNull();
  });
});
