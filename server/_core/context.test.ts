import { describe, expect, it } from "vitest";

import { createContext } from "./context";

describe("tRPC internal operator context", () => {
  it("opens the workspace as the internal admin without a bearer token", async () => {
    const req = { headers: {} };
    const res = {};

    const context = await createContext({ req, res } as never);

    expect(context.req).toBe(req);
    expect(context.res).toBe(res);
    expect(context.user).toMatchObject({
      name: "Site Launchpad Operator",
      role: "admin",
      loginMethod: "internal",
    });
  });
});
