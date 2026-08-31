import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = path.resolve(import.meta.dirname);

function source(relativePath: string): string {
  return readFileSync(path.join(clientRoot, relativePath), "utf8");
}

describe("campaign workspace error surfaces", () => {
  it("does not coerce clients.list errors into a No clients yet label", () => {
    const workspaceSource = source("contexts/WorkspaceContext.tsx");
    const listSource = source("features/clients/ClientsPage.tsx");

    expect(workspaceSource).toContain("clientsQuery.isError");
    expect(listSource).toContain("isError");
    expect(listSource).toContain("Clients could not be loaded");
    // A load failure must stay distinct from a genuinely empty workspace.
    const errorIndex = listSource.indexOf("isError");
    const emptyIndex = listSource.indexOf("clients.length === 0");
    expect(errorIndex).toBeGreaterThan(0);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
    expect(listSource).not.toContain("isUnauthorized");
    expect(listSource).not.toContain("Sign in again");
  });

  it("shows the campaign list failure instead of an invitation to create one", () => {
    const campaignsSource = source("features/campaigns/CampaignsPage.tsx");
    const errorIndex = campaignsSource.indexOf("listQuery.error");
    const createIndex = campaignsSource.indexOf("creatable.map");

    // A load failure must not read as a client that simply has no campaign.
    expect(errorIndex).toBeGreaterThan(0);
    expect(createIndex).toBeGreaterThan(errorIndex);
    expect(campaignsSource).not.toContain("Sign in again");
  });

  it("preserves a valid campaign deep link on initial mount", () => {
    const campaignsSource = source("features/campaigns/CampaignsPage.tsx");

    expect(campaignsSource).toContain("const previousClientIdRef = useRef(clientId)");
    expect(campaignsSource).toContain(
      "if (previousClientIdRef.current === clientId) return;",
    );
    expect(campaignsSource).toContain("previousClientIdRef.current = clientId;");
  });
});
