import type { User } from "../../drizzle/schema";
import { UnauthorizedError } from "../../shared/_core/errors";
import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  authenticateSupabaseRequest: vi.fn(),
}));

vi.mock("./supabaseAuth", () => ({
  authenticateSupabaseRequest: authMocks.authenticateSupabaseRequest,
}));

import { createContext } from "./context";

const user: User = {
  id: 1,
  authUserId: "123e4567-e89b-12d3-a456-426614174000",
  email: "operator@example.com",
  name: "Site Operator",
  loginMethod: "google",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("tRPC Supabase authentication context", () => {
  it("uses the Supabase Bearer authentication boundary", async () => {
    authMocks.authenticateSupabaseRequest.mockResolvedValueOnce(user);
    const req = { headers: { authorization: "Bearer signed-token" } };
    const res = {};

    const context = await createContext({ req, res } as never);

    expect(authMocks.authenticateSupabaseRequest).toHaveBeenCalledWith(req);
    expect(context.user).toBe(user);
  });

  it("keeps public procedures anonymous for an unauthenticated request", async () => {
    authMocks.authenticateSupabaseRequest.mockRejectedValueOnce(
      UnauthorizedError("Invalid access token."),
    );

    const context = await createContext({
      req: { headers: { authorization: "Bearer invalid-token" } },
      res: {},
    } as never);

    expect(context.user).toBeNull();
  });

  it("propagates user synchronization failures instead of treating them as anonymous", async () => {
    const synchronizationFailure = new Error("database unavailable");
    authMocks.authenticateSupabaseRequest.mockRejectedValueOnce(
      synchronizationFailure,
    );

    await expect(
      createContext({
        req: { headers: { authorization: "Bearer signed-token" } },
        res: {},
      } as never),
    ).rejects.toBe(synchronizationFailure);
  });
});
