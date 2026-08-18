import { describe, expect, it, vi } from "vitest";
import {
  SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE,
  createSupabaseBrowserClient,
  readSupabaseBrowserEnv,
} from "./supabaseClient";

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

  it("treats missing or blank public env as not configured", () => {
    expect(readSupabaseBrowserEnv(undefined, "publishable-test-key")).toEqual({
      configured: false,
      message: SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE,
    });
    expect(
      readSupabaseBrowserEnv("https://project-ref.supabase.co", "   "),
    ).toEqual({
      configured: false,
      message: SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE,
    });
  });

  it("still fail-closes when creating a client without public env", () => {
    const createClient = vi.fn();
    expect(() =>
      createSupabaseBrowserClient("", "publishable-test-key", createClient as never),
    ).toThrow(SUPABASE_BROWSER_NOT_CONFIGURED_MESSAGE);
    expect(createClient).not.toHaveBeenCalled();
  });
});
