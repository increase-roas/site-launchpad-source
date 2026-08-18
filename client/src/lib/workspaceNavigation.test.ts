import { describe, expect, it } from "vitest";
import {
  getClientIdFromWorkspacePath,
  getWorkspaceArea,
  integrationsRoute,
  publisherDestination,
  settingsRedirectFromLegacyClientPath,
  workspaceRoute,
} from "./workspaceNavigation";

describe("selected-client workspace navigation", () => {
  it("detects every destination from the current route", () => {
    expect(getWorkspaceArea("/")).toBe("clients");
    expect(getWorkspaceArea("/workspace/12/pages")).toBe("pages");
    expect(getWorkspaceArea("/workspace/12/funnels")).toBe("funnels");
    expect(getWorkspaceArea("/workspace/12/media")).toBe("media");
    expect(getWorkspaceArea("/workspace/12/settings")).toBe("settings");
    expect(getWorkspaceArea("/clients/12")).toBe("settings");
  });

  it("preserves the selected client when switching across all workspace destinations", () => {
    expect(workspaceRoute("pages", 21)).toBe("/workspace/21/pages");
    expect(workspaceRoute("funnels", 21)).toBe("/workspace/21/funnels");
    expect(workspaceRoute("media", 21)).toBe("/workspace/21/media");
    expect(workspaceRoute("settings", 21)).toBe("/workspace/21/settings");
    expect(workspaceRoute("clients", 21)).toBe("/");
  });

  it("loads a new client id from both modern and legacy client paths", async () => {
    expect(getClientIdFromWorkspacePath("/workspace/44/pages")).toBe(44);
    expect(getClientIdFromWorkspacePath("/clients/44")).toBe(44);
    expect(getClientIdFromWorkspacePath("/")).toBeUndefined();
  });

  it("redirects legacy client editor URLs to workspace settings", () => {
    expect(settingsRedirectFromLegacyClientPath("/clients/5")).toBe("/workspace/5/settings");
    expect(settingsRedirectFromLegacyClientPath("/clients/new")).toBeNull();
    expect(settingsRedirectFromLegacyClientPath("/workspace/5/settings")).toBeNull();
  });
});

describe("Paid Ads funnel destinations stay under Funnels", () => {
  it("does not add a top-level website Templates route", () => {
    expect(workspaceRoute("funnels", 4)).toBe("/workspace/4/funnels");
    expect(workspaceRoute("funnels", 4)).not.toContain("/templates");
    expect(getWorkspaceArea("/templates")).toBe("clients");
    expect(getWorkspaceArea("/workspace/4/funnels?tab=templates")).toBe("funnels");
    expect(getWorkspaceArea("/workspace/4/funnels?studio=generic-paid-funnel")).toBe("funnels");
  });
});

describe("Client integrations destination", () => {
  it("keeps the thin Integrations page under the selected client", () => {
    expect(integrationsRoute(9)).toBe("/workspace/9/integrations");
    expect(getWorkspaceArea("/workspace/9/integrations")).toBe("settings");
    expect(getClientIdFromWorkspacePath("/workspace/9/integrations")).toBe(9);
  });
});

describe("real publisher destinations", () => {
  it("routes header Publish to the website or selected funnel publisher", () => {
    expect(publisherDestination({ clientId: 9, area: "pages" })).toBe(
      "/workspace/9/settings",
    );
    expect(publisherDestination({ clientId: 9, area: "settings" })).toBe(
      "/workspace/9/settings",
    );
    expect(
      publisherDestination({ clientId: 9, area: "funnels", search: "?funnel=12" }),
    ).toBe("/workspace/9/funnels?funnel=12");
    expect(
      publisherDestination({
        clientId: 9,
        area: "funnels",
        search: "?studio=generic-paid-funnel",
      }),
    ).toBe("/workspace/9/funnels?studio=generic-paid-funnel");
  });
});
