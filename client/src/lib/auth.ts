import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_CALLBACK_ERROR_MESSAGE =
  "We couldn't sign you in. Please try again.";
export const UNAPPROVED_ACCOUNT_MESSAGE =
  "This Google account isn't approved for Site Launchpad. Ask the owner to add you.";

type SignInAuth = Pick<SupabaseClient["auth"], "signInWithOAuth">;
type SessionAuth = Pick<SupabaseClient["auth"], "getSession">;
type SignOutAuth = Pick<SupabaseClient["auth"], "signOut">;

type AuthCallbackDependencies = {
  exchangeCodeForSession: SupabaseClient["auth"]["exchangeCodeForSession"];
  replaceVisibleUrl: (path: string) => void;
  redirectHome: (path: string) => void;
};

export type AuthCallbackResult =
  | { status: "success" }
  | { status: "already-handled" }
  | { status: "error"; message: string };

export async function startGoogleLogin(
  auth: SignInAuth,
  origin: string,
): Promise<void> {
  const { error } = await auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) {
    throw new Error("Google sign-in could not start.");
  }
}

export type SwitchGoogleAccountResult =
  | "started"
  | "logout-failed"
  | "login-failed";

export async function switchGoogleAccount({
  logout,
  startLogin,
}: {
  logout: () => Promise<void>;
  startLogin: () => Promise<void>;
}): Promise<SwitchGoogleAccountResult> {
  try {
    await logout();
  } catch {
    return "logout-failed";
  }

  try {
    await startLogin();
    return "started";
  } catch {
    return "login-failed";
  }
}

export function createAuthCallbackHandler(): (
  url: URL,
  dependencies: AuthCallbackDependencies,
) => Promise<AuthCallbackResult> {
  const handledCodes = new Set<string>();
  return async (url, dependencies) => {
    const code = url.searchParams.get("code");
    if (!code) {
      return {
        status: "error",
        message: AUTH_CALLBACK_ERROR_MESSAGE,
      };
    }
    if (handledCodes.has(code)) {
      return { status: "already-handled" };
    }

    handledCodes.add(code);
    dependencies.replaceVisibleUrl("/auth/callback");
    const { error } =
      await dependencies.exchangeCodeForSession(code);
    if (error) {
      return {
        status: "error",
        message: AUTH_CALLBACK_ERROR_MESSAGE,
      };
    }

    dependencies.redirectHome("/");
    return { status: "success" };
  };
}

export async function signOutAndClearAuth(
  auth: SignOutAuth,
  clearAuthState: () => Promise<void>,
): Promise<void> {
  const { error } = await auth.signOut();
  if (error) {
    throw new Error("Sign out failed.");
  }
  await clearAuthState();
}

export async function getSupabaseBearerHeaders(
  auth: SessionAuth,
): Promise<Record<string, string>> {
  const { data, error } = await auth.getSession();
  if (error) {
    throw new Error("Authentication session is temporarily unavailable.");
  }
  if (!data.session?.access_token) return {};
  return {
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

export function isUnauthorizedAuthResult({
  hasSession,
  querySucceeded,
  user,
}: {
  hasSession: boolean;
  querySucceeded: boolean;
  user: unknown | null;
}): boolean {
  return hasSession && querySucceeded && user === null;
}
