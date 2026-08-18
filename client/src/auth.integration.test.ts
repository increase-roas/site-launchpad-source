import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = path.resolve(import.meta.dirname);

function source(relativePath: string): string {
  return readFileSync(path.join(clientRoot, relativePath), "utf8");
}

describe("direct internal workspace access", () => {
  it("opens tRPC without a browser session or Google bearer header", () => {
    const mainSource = source("main.tsx");

    expect(mainSource).toContain('credentials: "same-origin"');
    expect(mainSource).toContain("API_REQUEST_TIMEOUT_MS");
    expect(mainSource).toContain("fetchWithTimeout");
    expect(mainSource).toContain("httpLink");
    expect(mainSource).not.toContain("httpBatchLink");
    expect(mainSource).not.toContain("getSupabaseBearerHeaders");
    expect(mainSource).not.toContain("supabase");
    expect(mainSource).not.toContain("sessionStorage");
    expect(mainSource).not.toContain("manus-cookie");
    expect(mainSource).not.toContain("startLogin");
  });

  it("does not block an Astro save on refetches or poll an idle publisher", () => {
    const editorSource = source("pages/AstroClientEditor.tsx");

    expect(editorSource).toContain("utils.astroConfig.get.setData(queryInput, view)");
    expect(editorSource).toContain("void utils.clients.list.invalidate()");
    expect(editorSource).not.toContain(
      "await Promise.all([utils.clients.list.invalidate(), utils.astroConfig.get.invalidate(queryInput)])",
    );
    expect(editorSource).toContain("return isPublishActive(publishState) ? 3_000 : false");
    expect(editorSource).toContain("Website configuration could not be loaded");
  });

  it("bounds clients.list without automatic retries and preserves the visible retry state", () => {
    const homeSource = source("pages/Home.tsx");
    const workspaceSource = source("contexts/WorkspaceContext.tsx");

    for (const clientsListSource of [homeSource, workspaceSource]) {
      expect(clientsListSource).toContain("retry: false");
    }
    expect(homeSource).toContain("Clients could not be loaded");
    expect(homeSource).toContain("clientsQuery.refetch()");
  });

  it("has no OAuth callback route", () => {
    const appSource = source("App.tsx");

    expect(appSource).not.toContain("AuthCallback");
    expect(appSource).not.toContain('/auth/callback');
  });

  it("renders the workspace directly without sign-in or sign-out controls", () => {
    const layoutSource = source("components/DashboardLayout.tsx");

    expect(layoutSource).not.toContain("useAuth");
    expect(layoutSource).not.toContain("Sign in with Google");
    expect(layoutSource).not.toContain("UNAPPROVED_ACCOUNT_MESSAGE");
    expect(layoutSource).not.toContain("switchGoogleAccount");
    expect(layoutSource).not.toContain("Sign out");
    expect(layoutSource).toContain("<WorkspaceProvider>");
  });

  it("loads public R2 previews directly without protected storage fetches", () => {
    const previewSources = [
      source("components/ImageUploadCard.tsx"),
      source("pages/MediaWorkspace.tsx"),
      source("components/funnels/SimpleFormFunnelEditor.tsx"),
    ];

    for (const previewSource of previewSources) {
      expect(previewSource).toContain("<img");
      expect(previewSource).not.toContain("AuthenticatedImage");
    }
  });

  it("keeps direct R2 upload requests credential-free", () => {
    const uploadSource = source("lib/assetUpload.ts");

    expect(uploadSource).toContain('credentials: "omit"');
  });
});
