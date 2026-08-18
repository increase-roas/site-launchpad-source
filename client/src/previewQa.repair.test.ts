import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = path.resolve(import.meta.dirname);

function source(relativePath: string): string {
  return readFileSync(path.join(clientRoot, relativePath), "utf8");
}

describe("paid ads workspace error surfaces", () => {
  it("does not coerce clients.list errors into a No clients yet label", () => {
    const workspaceSource = source("contexts/WorkspaceContext.tsx");
    const switcherSource = source("components/ClientSwitcher.tsx");

    expect(workspaceSource).toContain("clientsQuery.isError");
    expect(switcherSource).toContain("clientSwitcherLabel");
    expect(switcherSource).toContain("isError");
    expect(switcherSource).not.toContain("isUnauthorized");
    expect(switcherSource).not.toContain("Sign in again");
    expect(switcherSource).not.toContain(
      'clients.length ? "Choose client" : "No clients yet"',
    );
  });

  it("fails the Funnels page immediately on workspace.get error instead of retry-spinning", () => {
    const paidAdsSource = source("pages/PaidAdsWorkspace.tsx");
    const errorIndex = paidAdsSource.indexOf("workspaceQuery.isError");
    const loadingIndex = paidAdsSource.indexOf("workspaceQuery.isLoading");

    expect(paidAdsSource).toContain("shouldRetryWorkspaceQuery");
    expect(paidAdsSource).toContain("paidAdsWorkspaceErrorCopy");
    expect(paidAdsSource).not.toContain("Sign in again");
    expect(errorIndex).toBeGreaterThan(0);
    expect(loadingIndex).toBeGreaterThan(errorIndex);
  });
});
