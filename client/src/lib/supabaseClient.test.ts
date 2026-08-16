import { describe, expect, it, vi } from "vitest";
import { createSupabaseBrowserClient } from "./supabaseClient";

describe("Supabase browser client", () => {
  it("uses persistent PKCE sessions without automatic URL exchange", () => {
    const client = { auth: {} };
    const createClient = vi.fn(() => client);

    const result = createSupabaseBrowserClient(
      "https://project-ref.supabase.co",
      "publishable-test-key",
      createClient as never,
    );

    expect(result).toBe(client);
    expect(createClient).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "publishable-test-key",
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
        },
      },
    );
  });
});
