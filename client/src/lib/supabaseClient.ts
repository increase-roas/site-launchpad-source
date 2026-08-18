import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

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

export function createSupabaseBrowserClient(
  url: string,
  publishableKey: string,
  factory: BrowserClientFactory = createClient,
): SupabaseClient {
  if (!url.trim() || !publishableKey.trim()) {
    throw new Error("Supabase browser authentication is not configured.");
  }
  return factory(url, publishableKey, browserAuthOptions);
}
