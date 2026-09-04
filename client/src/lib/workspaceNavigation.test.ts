import { describe, expect, it } from "vitest";
import {
  campaignsRedirectFromLegacyPath,
  clientDestinationRoute,
  configurationRedirectFromLegacyPath,
  configurationRoute,
  configSectionElementId,
  getClientIdFromWorkspacePath,
  parseConfigurationSearch,
  tabForConfigSection,
  getWorkspaceArea,
  integrationsRoute,
  launchRedirectFromLegacyPath,
  launchRoute,
  publisherDestination,
  workspaceRoute,
} from "./workspaceNavigation";

describe("selected-client workspace navigation", () => {
  it("detects every destination from the current route", () => {
    expect(getWorkspaceArea("/")).toBe("overview");
    expect(getWorkspaceArea("/workspace/12")).toBe("overview");
    expect(getWorkspaceArea("/workspace/12/pages")).toBe("pages");
    expect(getWorkspaceArea("/workspace/12/campaigns")).toBe("campaigns");
    expect(getWorkspaceArea("/workspace/12/integrations")).toBe("integrations");
    expect(getWorkspaceArea("/workspace/12/configuration")).toBe("configuration");
    expect(getWorkspaceArea("/workspace/12/configuration?tab=media")).toBe("configuration");
    expect(getWorkspaceArea("/clients/12")).toBe("configuration");
  });

  it("keeps retired routes pointing at their replacement page", () => {
    expect(getWorkspaceArea("/workspace/12/settings")).toBe("configuration");
    expect(getWorkspaceArea("/workspace/12/media")).toBe("configuration");
    expect(getWorkspaceArea("/workspace/12/funnels")).toBe("campaigns");
  });

  it("preserves the selected client when switching across all workspace destinations", () => {
    expect(workspaceRoute("overview", 21)).toBe("/workspace/21");
    expect(workspaceRoute("configuration", 21)).toBe("/workspace/21/configuration");
    expect(workspaceRoute("pages", 21)).toBe("/workspace/21/pages");
    expect(workspaceRoute("campaigns", 21)).toBe("/workspace/21/campaigns");
    expect(workspaceRoute("integrations", 21)).toBe("/workspace/21/integrations");
    expect(workspaceRoute("overview")).toBe("/");
  });

  it("addresses configuration sub-tabs so other pages can deep-link", () => {
    expect(configurationRoute(7)).toBe("/workspace/7/configuration");
    expect(configurationRoute(7, "media")).toBe("/workspace/7/configuration?tab=media");
    expect(configurationRoute(7, "technical")).toBe("/workspace/7/configuration?tab=technical");
    expect(configurationRoute(7, "content", "homepage")).toBe(
      "/workspace/7/configuration?tab=content&section=homepage",
    );
    expect(configurationRoute(7, "content", "address")).toBe(
      "/workspace/7/configuration?tab=basic&section=address",
    );
    expect(tabForConfigSection("financing")).toBe("content");
    expect(configSectionElementId("homepage")).toBe("config-section-homepage");
  });

  it("reads the configuration tab and section from the query string", () => {
    expect(parseConfigurationSearch("?tab=content&section=homepage")).toEqual({
      tab: "content",
      section: "homepage",
    });
    expect(parseConfigurationSearch("?section=financing")).toEqual({
      tab: "content",
      section: "financing",
    });
    expect(parseConfigurationSearch("?tab=media")).toEqual({
      tab: "media",
      section: null,
    });
    expect(parseConfigurationSearch("")).toEqual({
      tab: "basic",
      section: null,
    });
    expect(parseConfigurationSearch("?tab=technical&section=homepage")).toEqual({
      tab: "content",
      section: "homepage",
    });
  });

  it("loads a new client id from both modern and legacy client paths", async () => {
    expect(getClientIdFromWorkspacePath("/workspace/44/pages")).toBe(44);
    expect(getClientIdFromWorkspacePath("/workspace/44")).toBe(44);
    expect(getClientIdFromWorkspacePath("/clients/44")).toBe(44);
    expect(getClientIdFromWorkspacePath("/")).toBeUndefined();
  });

  it("redirects legacy editor, settings and media URLs to the configuration page", () => {
    expect(configurationRedirectFromLegacyPath("/clients/5")).toBe("/workspace/5/configuration");
    expect(configurationRedirectFromLegacyPath("/workspace/5/settings")).toBe(
      "/workspace/5/configuration",
    );
    expect(configurationRedirectFromLegacyPath("/workspace/5/media")).toBe(
      "/workspace/5/configuration?tab=media",
    );
    expect(configurationRedirectFromLegacyPath("/clients/new")).toBeNull();
    expect(configurationRedirectFromLegacyPath("/workspace/5/configuration")).toBeNull();
  });
});

describe("campaign destinations stay under Campaigns", () => {
  it("does not add a top-level website Templates route", () => {
    expect(workspaceRoute("campaigns", 4)).toBe("/workspace/4/campaigns");
    expect(workspaceRoute("campaigns", 4)).not.toContain("/templates");
    expect(getWorkspaceArea("/templates")).toBe("overview");
    expect(getWorkspaceArea("/workspace/4/campaigns?campaign=12&tab=content")).toBe("campaigns");
  });

  it("redirects the retired funnels URL and keeps the deep link", () => {
    expect(campaignsRedirectFromLegacyPath("/workspace/4/funnels")).toBe(
      "/workspace/4/campaigns",
    );
    expect(campaignsRedirectFromLegacyPath("/workspace/4/funnels", "?funnel=12")).toBe(
      "/workspace/4/campaigns?campaign=12",
    );
    expect(campaignsRedirectFromLegacyPath("/workspace/4/funnels", "?studio=generic")).toBe(
      "/workspace/4/campaigns",
    );
    expect(campaignsRedirectFromLegacyPath("/workspace/4/campaigns")).toBeNull();
  });
});

describe("Client integrations destination", () => {
  it("keeps the thin Integrations page under the selected client", () => {
    expect(integrationsRoute(9)).toBe("/workspace/9/integrations");
    expect(getWorkspaceArea("/workspace/9/integrations")).toBe("integrations");
    expect(getClientIdFromWorkspacePath("/workspace/9/integrations")).toBe(9);
  });
});

describe("Launch owns pre-launch checks and publishing", () => {
  it("addresses Launch under the selected client", () => {
    expect(launchRoute(21)).toBe("/workspace/21/launch");
    expect(clientDestinationRoute("launch", 21)).toBe("/workspace/21/launch");
    expect(clientDestinationRoute("integrations", 21)).toBe(
      "/workspace/21/integrations",
    );
  });

  it("redirects the retired Preview & QA URL to Launch", () => {
    expect(launchRedirectFromLegacyPath("/workspace/6/preview-qa")).toBe(
      "/workspace/6/launch",
    );
    expect(launchRedirectFromLegacyPath("/workspace/6/launch")).toBeNull();
    expect(launchRedirectFromLegacyPath("/workspace/6/pages")).toBeNull();
  });
});

describe("real publisher destinations", () => {
  it("routes header Publish to the website or selected campaign publisher", () => {
    expect(publisherDestination({ clientId: 9, area: "overview" })).toBe(
      "/workspace/9/launch",
    );
    expect(publisherDestination({ clientId: 9, area: "pages" })).toBe(
      "/workspace/9/launch",
    );
    expect(publisherDestination({ clientId: 9, area: "configuration" })).toBe(
      "/workspace/9/launch",
    );
    expect(publisherDestination({ clientId: 9, area: "integrations" })).toBe(
      "/workspace/9/launch",
    );
    expect(
      publisherDestination({ clientId: 9, area: "campaigns", search: "?campaign=12" }),
    ).toBe("/workspace/9/campaigns?campaign=12");
    expect(
      publisherDestination({ clientId: 9, area: "campaigns", search: "?funnel=12" }),
    ).toBe("/workspace/9/campaigns?campaign=12");
    expect(publisherDestination({ clientId: 9, area: "campaigns" })).toBe(
      "/workspace/9/campaigns",
    );
  });
});
