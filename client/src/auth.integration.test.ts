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
    expect(mainSource).toContain('credentials: "omit"');
    expect(mainSource).not.toContain("sessionStorage");
    expect(mainSource).not.toContain("manus-cookie");
    expect(mainSource).not.toContain("startLogin");
    expect(useAuthSource).toContain("onAuthStateChange");
    expect(useAuthSource).toContain("signOutAndClearAuth");
    expect(useAuthSource).not.toContain("manus-runtime-user-info");
    expect(useAuthSource).not.toContain("startLogin");
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
});
