import type { User } from "../../drizzle/schema";
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

  it("keeps public procedures anonymous when authentication fails", async () => {
    authMocks.authenticateSupabaseRequest.mockRejectedValueOnce(
      new Error("Invalid access token."),
    );

    const context = await createContext({
      req: { headers: { authorization: "Bearer invalid-token" } },
      res: {},
    } as never);

    expect(context.user).toBeNull();
  });
});
