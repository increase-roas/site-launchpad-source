import { signOutAndClearAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !sessionLoading && Boolean(session),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
      queueMicrotask(() => {
        void utils.auth.me.invalidate();
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    const loading =
      sessionLoading ||
      signingOut ||
      (Boolean(session) && meQuery.isLoading);
    return {
      user,
      loading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(user),
      isUnauthorized: Boolean(session && !loading && !user),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    session,
    sessionLoading,
    signingOut,
  ]);

  const logout = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOutAndClearAuth(supabase.auth, async () => {
        setSession(null);
        utils.auth.me.setData(undefined, null);
        queryClient.clear();
      });
    } finally {
      setSigningOut(false);
    }
  }, [queryClient, utils]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
