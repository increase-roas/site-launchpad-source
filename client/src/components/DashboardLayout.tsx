import { Button } from "@/components/ui/button";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getWorkspaceArea,
  publisherDestination,
  workspaceRoute,
  type WorkspaceArea,
} from "@/lib/workspaceNavigation";
import {
  Eye,
  Images,
  Moon,
  PanelsTopLeft,
  Rocket,
  Route,
  Settings,
  Sun,
  UsersRound,
} from "lucide-react";
import { ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ClientSwitcher } from "./ClientSwitcher";
import { WorkspaceBreadcrumbs } from "./WorkspaceBreadcrumbs";

function breadcrumbItems(location: string, clientName?: string): string[] {
  if (location === "/") return ["Clients"];
  if (location === "/clients/new") return ["Clients", "Add client"];
  const name = clientName ?? "Client";
  const area = getWorkspaceArea(location);
  if (area === "pages") return [name, "Website", "Pages"];
  if (area === "funnels") {
    const search = typeof window === "undefined" ? "" : window.location.search;
    if (search.includes("studio=")) return [name, "Paid Ads", "Funnels", "Builder"];
    if (search.includes("tab=mine")) return [name, "Paid Ads", "Funnels", "My Funnels"];
    if (search.includes("tab=templates")) return [name, "Paid Ads", "Funnels", "Templates"];
    return [name, "Paid Ads", "Funnels"];
  }
  if (area === "media") return [name, "Media"];
  if (location.includes("/integrations")) return [name, "Integrations"];
  if (area === "settings") return [name, "Settings"];
  return ["Clients"];
}

type DashboardShellProps = {
  children: ReactNode;
};

function DashboardShell({ children }: DashboardShellProps) {
  const { selectedClientId, selectedClient, selectClient } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const area = getWorkspaceArea(location);

  const handleClientSelect = (clientId: number) => {
    selectClient(clientId);
    const targetArea = area === "clients" ? "pages" : area;
    setLocation(workspaceRoute(targetArea, clientId));
  };

  const navItems: Array<{ area: WorkspaceArea; label: string; icon: typeof UsersRound }> = [
    { area: "clients", label: "Clients", icon: UsersRound },
    { area: "pages", label: "Pages", icon: PanelsTopLeft },
    { area: "funnels", label: "Funnels", icon: Route },
    { area: "media", label: "Media", icon: Images },
    { area: "settings", label: "Settings", icon: Settings },
  ];

  const preview = () => {
    const liveUrl = selectedClient?.operationalSummary.liveUrl;
    const url = liveUrl || selectedClient?.client.websiteUrl;
    if (!url) {
      toast.error("Choose a client with a live site or website address first.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const publish = () => {
    if (!selectedClientId) {
      toast.error("Choose a client first.");
      return;
    }
    setLocation(
      publisherDestination({
        clientId: selectedClientId,
        area,
        search: typeof window === "undefined" ? "" : window.location.search,
      }),
    );
  };

  return (
    <div className="launchpad-app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-stretch px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="mr-3 flex shrink-0 items-center gap-2 pr-3 text-left sm:mr-5 sm:border-r sm:border-border sm:pr-5"
            aria-label="Open clients"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Rocket className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-extrabold tracking-tight sm:block">Site Launchpad</span>
          </button>

          <nav className="hidden min-w-0 flex-1 items-stretch lg:flex" aria-label="Main navigation">
            {navItems.map(item => {
              const active = area === item.area;
              const disabled = item.area !== "clients" && !selectedClientId;
              return (
                <button
                  key={item.area}
                  type="button"
                  disabled={disabled}
                  onClick={() => setLocation(workspaceRoute(item.area, selectedClientId))}
                  className={`relative flex items-center gap-1.5 px-3 text-[12px] font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary after:transition-opacity ${
                    active
                      ? "text-primary after:opacity-100"
                      : "text-muted-foreground after:opacity-0 hover:text-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 py-2">
            <ClientSwitcher
              compact
              onSelect={handleClientSelect}
              onAddClient={() => setLocation("/clients/new")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-md border-border bg-card"
              aria-label={theme === "light" ? "Use dark theme" : "Use light theme"}
              title={theme === "light" ? "Use dark theme" : "Use light theme"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedClientId}
              onClick={preview}
              className="hidden h-9 gap-1.5 rounded-md border-border bg-card px-2.5 text-xs font-semibold sm:flex"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedClientId}
              onClick={publish}
              className="hidden h-9 gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:flex"
            >
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-background/80">
        <div className="mx-auto hidden h-9 w-full max-w-[1180px] items-center px-4 md:flex">
          <WorkspaceBreadcrumbs
            items={breadcrumbItems(location, selectedClient?.client.businessName)}
          />
        </div>
      </div>

      <main className="launchpad-workspace mx-auto min-h-[calc(100vh-5.75rem)] w-full max-w-[1180px] p-3 pb-24 sm:p-4 sm:pb-24 lg:px-5 lg:py-5">
        {children}
      </main>

      <nav className="launchpad-mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {navItems.map(item => {
          const active = area === item.area;
          const disabled = item.area !== "clients" && !selectedClientId;
          return (
            <button
              key={item.area}
              type="button"
              disabled={disabled}
              onClick={() => setLocation(workspaceRoute(item.area, selectedClientId))}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold ${
                active ? "bg-primary/8 text-primary" : "text-muted-foreground"
              } disabled:opacity-30`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
