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
    expect(editorSource).not.toContain("astroConfig.publishStatus");
    expect(editorSource).not.toContain("startPublish");
    expect(editorSource).not.toContain("advancePublish");
    expect(editorSource).not.toContain("Website publishing");
    expect(editorSource).not.toContain('"Saved"');
    expect(editorSource).not.toContain("Changes waiting");
    expect(editorSource).not.toContain("ConfigurationVerification");
    expect(editorSource).toContain("Website configuration could not be loaded");
  });

  it("bounds clients.list without automatic retries and preserves the visible retry state", () => {
    const workspaceSource = source("contexts/WorkspaceContext.tsx");
    const directorySource = source("app/ClientDirectory.tsx");
    const clientsSource = source("features/clients/ClientsPage.tsx");

    expect(workspaceSource).toContain("retry: false");
    expect(workspaceSource).toContain("clientsQuery.refetch()");

    // Both client-list surfaces must name the failure and offer a manual retry.
    for (const listSource of [directorySource, clientsSource]) {
      expect(listSource).toContain("Clients could not be loaded");
      expect(listSource).toContain("refetchClients");
    }
  });

  it("has no OAuth callback route", () => {
    const appSource = source("App.tsx");

    expect(appSource).not.toContain("AuthCallback");
    expect(appSource).not.toContain('/auth/callback');
  });

  it("renders the workspace directly without sign-in or sign-out controls", () => {
    const layoutSource = source("app/AppShell.tsx");

    expect(layoutSource).not.toContain("useAuth");
    expect(layoutSource).not.toContain("Sign in with Google");
    expect(layoutSource).not.toContain("UNAPPROVED_ACCOUNT_MESSAGE");
    expect(layoutSource).not.toContain("switchGoogleAccount");
    expect(layoutSource).not.toContain("Sign out");
    expect(layoutSource).toContain("<WorkspaceProvider>");
  });

  it("deletes a client from the factory list after confirmation", () => {
    const table = source("components/clients/ClientsTable.tsx");
    expect(table).toContain("onDeleteRequest");
    expect(table).toContain("Delete");
    expect(table).toContain("createRowClickSuppressor");
    expect(table).toContain("rowClickGate.suppress()");
    expect(table).toContain("modal={false}");
    const page = source("features/clients/ClientsPage.tsx");
    expect(page).toContain("clients.delete");
    expect(page).toContain("AlertDialog");
  });

  it("starts a factory preview instead of opening a published live URL", () => {
    const layoutSource = source("app/AppShell.tsx");

    expect(layoutSource).toContain("openFactoryPreview");
    expect(layoutSource).toContain("startPreview.mutate");
    expect(layoutSource).not.toContain("href={previewUrl}");
    expect(layoutSource).not.toContain("clientPreviewHref");
  });

  it("loads public R2 previews directly without protected storage fetches", () => {
    const previewSources = [
      source("components/astro/media/MediaWorkspace.tsx"),
      source("components/astro/media/MediaSlotDetail.tsx"),
      source("features/campaigns/campaignFields.tsx"),
    ];

    for (const previewSource of previewSources) {
      expect(previewSource).toContain("<img");
      expect(previewSource).not.toContain("AuthenticatedImage");
    }

    expect(source("components/astro/MediaTab.tsx")).not.toContain("AuthenticatedImage");
  });

  it("keeps direct R2 upload requests credential-free", () => {
    const uploadSource = source("lib/assetUpload.ts");

    expect(uploadSource).toContain('credentials: "omit"');
  });
});
