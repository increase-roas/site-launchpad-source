import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startLogin } from "@/const";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import {
  UNAPPROVED_ACCOUNT_MESSAGE,
  switchGoogleAccount,
} from "@/lib/auth";
import {
  getWorkspaceArea,
  workspaceRoute,
  type WorkspaceArea,
} from "@/lib/workspaceNavigation";
import {
  Eye,
  Images,
  LogOut,
  PanelsTopLeft,
  Rocket,
  Route,
  Settings,
  UsersRound,
} from "lucide-react";
import { ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ClientSwitcher } from "./ClientSwitcher";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { WorkspaceBreadcrumbs } from "./WorkspaceBreadcrumbs";

function breadcrumbItems(location: string, clientName?: string): string[] {
  if (location === "/") return ["Clients"];
  if (location === "/clients/new") return ["Clients", "Add client"];
  const name = clientName ?? "Client";
  const area = getWorkspaceArea(location);
  if (area === "pages") return [name, "Website", "Pages"];
  if (area === "funnels") return [name, "Paid Ads", "Funnels"];
  if (area === "media") return [name, "Media"];
  if (area === "settings") return [name, "Settings"];
  return ["Clients"];
}

type DashboardShellProps = {
  children: ReactNode;
  user: {
    name: string | null;
    email: string | null;
  };
  logout: () => Promise<void>;
};

function DashboardShell({
  children,
  user,
  logout,
}: DashboardShellProps) {
  const { selectedClientId, selectedClient, selectClient } = useWorkspace();
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
    const url = selectedClient?.client.websiteUrl;
    if (!url) {
      toast.error("Choose a client with a website address first.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const publish = () => {
    if (!selectedClientId) {
      toast.error("Choose a client first.");
      return;
    }
    setLocation(`/workspace/${selectedClientId}/settings`);
    toast.info("Finish the checklist, then use Launch Site.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(10,18,28,0.99),rgba(7,13,21,0.99))] lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/8 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,0.22)]">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Site Launchpad</p>
            <p className="text-xs font-semibold text-muted-foreground">Client workspace</p>
          </div>
        </div>

        <div className="border-b border-white/8 p-4">
          <ClientSwitcher
            onSelect={handleClientSelect}
            onAddClient={() => setLocation("/clients/new")}
          />
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="Main navigation">
          {navItems.map(item => {
            const active = area === item.area;
            const needsClient = item.area !== "clients";
            const disabled = needsClient && !selectedClientId;
            return (
              <button
                key={item.area}
                type="button"
                disabled={disabled}
                onClick={() => setLocation(workspaceRoute(item.area, selectedClientId))}
                className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold transition-colors ${
                  active
                    ? "bg-cyan-400/12 text-cyan-300 ring-1 ring-cyan-300/10"
                    : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"
                } disabled:cursor-not-allowed disabled:opacity-35`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/8 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/[0.04]">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-white/[0.05] text-sm font-extrabold">
                    {user?.name?.charAt(0).toUpperCase() ?? "A"}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{user?.name ?? "Agency team"}</span>
                  <span className="block truncate text-xs font-semibold text-muted-foreground">
                    {user?.email ?? ""}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-white/10 bg-popover">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-300 focus:text-red-200">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-40 flex min-h-18 items-center justify-between gap-3 border-b border-white/8 bg-background/92 px-3 py-3 backdrop-blur-xl sm:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <ClientSwitcher
                compact
                onSelect={handleClientSelect}
                onAddClient={() => setLocation("/clients/new")}
              />
            </div>
            <div className="hidden min-w-0 md:block">
              <WorkspaceBreadcrumbs
                items={breadcrumbItems(location, selectedClient?.client.businessName)}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedClientId}
              onClick={preview}
              className="h-10 gap-2 rounded-xl border-white/10 bg-white/[0.025] px-3 font-extrabold"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedClientId}
              onClick={publish}
              className="h-10 gap-2 rounded-xl bg-cyan-400 px-3 font-extrabold text-slate-950 hover:bg-cyan-300"
            >
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4.5rem)] p-3 pb-24 sm:p-5 sm:pb-24 lg:p-6 lg:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/10 bg-[rgba(8,15,24,0.97)] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {navItems.map(item => {
          const active = area === item.area;
          const disabled = item.area !== "clients" && !selectedClientId;
          return (
            <button
              key={item.area}
              type="button"
              disabled={disabled}
              onClick={() => setLocation(workspaceRoute(item.area, selectedClientId))}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold ${
                active ? "bg-cyan-400/10 text-cyan-300" : "text-muted-foreground"
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
  const { error, isUnauthorized, loading, logout, refresh, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    const temporarilyUnavailable = Boolean(error) && !isUnauthorized;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-white/8 bg-card/70 p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
            <Rocket className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {temporarilyUnavailable
                ? "Workspace temporarily unavailable"
                : isUnauthorized
                ? "Account not approved"
                : "Sign in to Site Launchpad"}
            </h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">
              {temporarilyUnavailable
                ? "Your signed-in session is still intact. Retry the workspace connection."
                : isUnauthorized
                ? UNAPPROVED_ACCOUNT_MESSAGE
                : "Only your agency team can open this workspace."}
            </p>
          </div>
          <Button
            onClick={() => {
              if (temporarilyUnavailable) {
                void refresh();
                return;
              }
              if (isUnauthorized) {
                void switchGoogleAccount({
                  logout,
                  startLogin,
                }).then(result => {
                  switch (result) {
                    case "started":
                      return;
                    case "logout-failed":
                      toast.error(
                        "Sign out failed. Please try again.",
                      );
                      return;
                    case "login-failed":
                      toast.error(
                        "Google sign-in could not start.",
                      );
                      return;
                    default: {
                      const exhaustiveResult: never = result;
                      return exhaustiveResult;
                    }
                  }
                });
                return;
              }
              void startLogin().catch(() => {
                toast.error("Google sign-in could not start.");
              });
            }}
            size="lg"
            className="h-14 w-full rounded-2xl bg-cyan-400 text-base font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            {temporarilyUnavailable
              ? "Retry"
              : isUnauthorized
              ? "Use another Google account"
              : "Sign in with Google"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <DashboardShell user={user} logout={logout}>
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
