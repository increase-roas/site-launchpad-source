import {
  AUTH_CALLBACK_ERROR_MESSAGE,
  createAuthCallbackHandler,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const handleAuthCallback = createAuthCallbackHandler();

export default function AuthCallback() {
  const started = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void handleAuthCallback(new URL(window.location.href), {
      exchangeCodeForSession: code =>
        supabase.auth.exchangeCodeForSession(code),
      replaceVisibleUrl: path =>
        window.history.replaceState({}, "", path),
      redirectHome: path => window.location.replace(path),
    }).then(result => {
      if (result.status === "error") {
        setErrorMessage(result.message);
      }
    });
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-card/70 p-8 text-center">
        {errorMessage ? (
          <>
            <h1 className="text-2xl font-semibold">
              Sign-in failed
            </h1>
            <p className="mt-3 text-muted-foreground">
              {errorMessage}
            </p>
            <a
              href="/"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
            >
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <h1 className="mt-5 text-2xl font-semibold">
              Finishing sign-in
            </h1>
            <p className="mt-3 text-muted-foreground">
              You will return to Site Launchpad automatically.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export { AUTH_CALLBACK_ERROR_MESSAGE };
