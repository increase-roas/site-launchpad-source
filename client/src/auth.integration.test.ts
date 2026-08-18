import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = path.resolve(import.meta.dirname);

function source(relativePath: string): string {
  return readFileSync(path.join(clientRoot, relativePath), "utf8");
}

describe("active client authentication wiring", () => {
  it("uses Supabase sessions for tRPC without Manus storage or automatic login redirects", () => {
    const mainSource = source("main.tsx");
    const useAuthSource = source("_core/hooks/useAuth.ts");

    expect(mainSource).toContain("getSupabaseBearerHeaders");
    expect(mainSource).toContain('credentials: "same-origin"');
    expect(mainSource).toContain("API_REQUEST_TIMEOUT_MS");
    expect(mainSource).toContain("fetchWithTimeout");
    expect(mainSource).toContain("httpLink");
    expect(mainSource).not.toContain("httpBatchLink");
    expect(mainSource).not.toContain("sessionStorage");
    expect(mainSource).not.toContain("manus-cookie");
    expect(mainSource).not.toContain("startLogin");
    expect(useAuthSource).toContain("onAuthStateChange");
    expect(useAuthSource).toContain("signOutAndClearAuth");
    expect(useAuthSource).not.toContain("manus-runtime-user-info");
    expect(useAuthSource).not.toContain("startLogin");
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

  it("routes the explicit callback outside the authenticated dashboard shell", () => {
    const appSource = source("App.tsx");

    expect(appSource).toContain('path="/auth/callback"');
    expect(appSource.indexOf('path="/auth/callback"')).toBeLessThan(
      appSource.indexOf("<DashboardLayout>"),
    );
  });

  it("shows explicit Google login and unauthorized-account states", () => {
    const layoutSource = source("components/DashboardLayout.tsx");

    expect(layoutSource).toContain("Sign in with Google");
    expect(layoutSource).toContain("UNAPPROVED_ACCOUNT_MESSAGE");
    expect(layoutSource).toContain("switchGoogleAccount");
    expect(layoutSource).toContain("logout,");
    expect(layoutSource).toContain("startLogin,");
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
