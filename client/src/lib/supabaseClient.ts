import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE =
  "Supabase browser authentication is not configured.";

type BrowserClientFactory = (
  url: string,
  publishableKey: string,
  options: {
    auth: {
      autoRefreshToken: true;
      detectSessionInUrl: false;
      flowType: "pkce";
      persistSession: true;
    };
  },
) => SupabaseClient;

const browserAuthOptions = {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    persistSession: true,
  },
} as const;

export type SupabaseBrowserEnv =
  | { configured: true; url: string; publishableKey: string }
  | { configured: false; message: string };

export function readSupabaseBrowserEnv(
  url: string | undefined,
  publishableKey: string | undefined,
): SupabaseBrowserEnv {
  const trimmedUrl = (url ?? "").trim();
  const trimmedKey = (publishableKey ?? "").trim();
  if (!trimmedUrl || !trimmedKey) {
    return {
      configured: false,
      message: SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE,
    };
  }
  return {
    configured: true,
    url: trimmedUrl,
    publishableKey: trimmedKey,
  };
}

export function createSupabaseBrowserClient(
  url: string,
  publishableKey: string,
  factory: BrowserClientFactory = createClient,
): SupabaseClient {
  const env = readSupabaseBrowserEnv(url, publishableKey);
  if (!env.configured) {
    throw new Error(env.message);
  }
  return factory(env.url, env.publishableKey, browserAuthOptions);
}
