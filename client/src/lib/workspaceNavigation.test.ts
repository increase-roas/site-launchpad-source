import { describe, expect, it } from "vitest";
import {
  getClientIdFromWorkspacePath,
  getWorkspaceArea,
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

  it("loads a new client id from both modern and legacy client paths", () => {
    expect(getClientIdFromWorkspacePath("/workspace/44/pages")).toBe(44);
    expect(getClientIdFromWorkspacePath("/clients/44")).toBe(44);
    expect(getClientIdFromWorkspacePath("/")).toBeUndefined();
  });
});
