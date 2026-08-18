import { trpc } from "@/lib/trpc";
import { fetchWithTimeout } from "@shared/requestTimeout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import BootConfigurationError from "./components/BootConfigurationError";
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
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const publicUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const publicKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

if (!publicUrl || !publicKey) {
  createRoot(rootElement).render(
    <BootConfigurationError message="Supabase browser authentication is not configured." />,
  );
} else {
  createRoot(rootElement).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>,
  );
}
