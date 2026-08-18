import { readSupabaseBrowserEnv } from "@/lib/supabaseClient";
import { createRoot } from "react-dom/client";
import BootConfigurationError from "./components/BootConfigurationError";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const supabaseBrowserEnv = readSupabaseBrowserEnv(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

if (!supabaseBrowserEnv.configured) {
  createRoot(rootElement).render(
    <BootConfigurationError message={supabaseBrowserEnv.message} />,
  );
} else {
  void import("./bootApp").then(({ bootApp }) => {
    bootApp(rootElement);
  });
}
