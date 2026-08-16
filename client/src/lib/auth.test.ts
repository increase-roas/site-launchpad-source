import { describe, expect, it, vi } from "vitest";
import {
  AUTH_CALLBACK_ERROR_MESSAGE,
  UNAPPROVED_ACCOUNT_MESSAGE,
  createAuthCallbackHandler,
  fetchAuthenticatedStorageObject,
  getSupabaseBearerHeaders,
  signOutAndClearAuth,
  startGoogleLogin,
  switchGoogleAccount,
} from "./auth";

describe("Supabase browser authentication", () => {
  it("starts Google OAuth with the current-origin callback", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { provider: "google", url: null },
      error: null,
    }));

    await startGoogleLogin(
      { signInWithOAuth } as never,
      "https://launchpad.example",
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://launchpad.example/auth/callback",
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  });

  it("logs out before immediately starting account-switch login", async () => {
    const events: string[] = [];
    const logout = vi.fn(async () => {
      events.push("logout");
    });
    const startLogin = vi.fn(async () => {
      events.push("login");
    });

    await expect(
      switchGoogleAccount({ logout, startLogin }),
    ).resolves.toBe("started");
    expect(events).toEqual(["logout", "login"]);
  });

  it("does not start login when account-switch logout fails", async () => {
    const startLogin = vi.fn(async () => undefined);

    await expect(
      switchGoogleAccount({
        logout: vi.fn(async () => {
          throw new Error("sign out failed");
        }),
        startLogin,
      }),
    ).resolves.toBe("logout-failed");
    expect(startLogin).not.toHaveBeenCalled();
  });

  it("reports account-switch login failure after successful logout", async () => {
    await expect(
      switchGoogleAccount({
        logout: vi.fn(async () => undefined),
        startLogin: vi.fn(async () => {
          throw new Error("login failed");
        }),
      }),
    ).resolves.toBe("login-failed");
  });

  it("exchanges a callback code once, removes it from the URL, and redirects home", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({
      data: { session: {} },
      error: null,
    }));
    const replaceVisibleUrl = vi.fn();
    const redirectHome = vi.fn();
    const handleCallback = createAuthCallbackHandler();

    const first = await handleCallback(
      new URL("https://launchpad.example/auth/callback?code=one-time-code"),
      {
        exchangeCodeForSession,
        replaceVisibleUrl,
        redirectHome,
      },
    );
    const second = await handleCallback(
      new URL("https://launchpad.example/auth/callback?code=one-time-code"),
      {
        exchangeCodeForSession,
        replaceVisibleUrl,
        redirectHome,
      },
    );

    expect(first).toEqual({ status: "success" });
    expect(second).toEqual({ status: "already-handled" });
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(replaceVisibleUrl).toHaveBeenCalledWith("/auth/callback");
    expect(redirectHome).toHaveBeenCalledWith("/");
  });

  it("returns a plain-language callback error without redirecting", async () => {
    const redirectHome = vi.fn();
    const handleCallback = createAuthCallbackHandler();

    const result = await handleCallback(
      new URL("https://launchpad.example/auth/callback?code=bad-code"),
      {
        exchangeCodeForSession: vi.fn(async () => ({
          data: { session: null },
          error: new Error("exchange failed"),
        })),
        replaceVisibleUrl: vi.fn(),
        redirectHome,
      },
    );

    expect(result).toEqual({
      status: "error",
      message: AUTH_CALLBACK_ERROR_MESSAGE,
    });
    expect(redirectHome).not.toHaveBeenCalled();
  });

  it("signs out through Supabase and clears relevant query state", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const clearAuthState = vi.fn(async () => undefined);

    await signOutAndClearAuth({ signOut } as never, clearAuthState);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });

  it("sends the current Supabase access token as a Bearer header", async () => {
    const getSession = vi.fn(async () => ({
      data: {
        session: {
          access_token: "verified-access-token",
        },
      },
      error: null,
    }));

    await expect(
      getSupabaseBearerHeaders({ getSession } as never),
    ).resolves.toEqual({
      Authorization: "Bearer verified-access-token",
    });
  });

  it("sends no authorization header without a Supabase session", async () => {
    const getSession = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }));

    await expect(
      getSupabaseBearerHeaders({ getSession } as never),
    ).resolves.toEqual({});
  });

  it("uses the required unauthorized-account message exactly", () => {
    expect(UNAPPROVED_ACCOUNT_MESSAGE).toBe(
      "This Google account isn't approved for Site Launchpad. Ask the owner to add you.",
    );
  });

  it("authenticates storage proxy fetches with the same current access token", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image"]),
    }));
    const getSession = vi.fn(async () => ({
      data: {
        session: {
          access_token: "verified-access-token",
        },
      },
      error: null,
    }));

    await fetchAuthenticatedStorageObject(
      "/manus-storage/clients/7/hero.webp",
      {
        auth: { getSession } as never,
        fetchFn: fetchFn as never,
      },
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "/manus-storage/clients/7/hero.webp",
      {
        credentials: "omit",
        headers: {
          Authorization: "Bearer verified-access-token",
        },
        signal: undefined,
      },
    );
  });
});
