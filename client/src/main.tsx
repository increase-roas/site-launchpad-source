import { getSupabaseBearerHeaders } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { fetchWithTimeout } from "@shared/requestTimeout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const API_REQUEST_TIMEOUT_MS = 45_000;
const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        return await getSupabaseBearerHeaders(supabase.auth);
      },
      fetch(input, init) {
        return fetchWithTimeout(
          globalThis.fetch,
          input,
          {
            ...(init ?? {}),
            credentials: "same-origin",
          },
          API_REQUEST_TIMEOUT_MS,
        );
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
