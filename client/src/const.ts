import { startGoogleLogin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const startLogin = (): Promise<void> =>
  startGoogleLogin(supabase.auth, window.location.origin);
