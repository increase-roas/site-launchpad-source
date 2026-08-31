import { StatusPill } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { clientStatusTone } from "@/lib/clientBoard";
import { cn } from "@/lib/utils";
import {
  configurationRoute,
  getWorkspaceArea,
  workspaceRoute,
} from "@/lib/workspaceNavigation";
import {
  SECTION_GROUPS,
  SECTION_GROUP_LABELS,
  getPrimarySection,
  isClientScopedLocation,
  sectionsInGroup,
  type PrimarySection,
} from "./navigation";
import { CLIENT_TAB_LIST, clientTabHref, getClientTab } from "./clientTabs";
import { ClientAvatar, ClientDirectory } from "./ClientDirectory";
import {
  Activity,
  ExternalLink,
  Eye,
  LayoutTemplate,
  Menu,
  Plus,
  Rocket,
  Settings,
  Settings2,
  Signal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const SECTION_ICONS: Record<PrimarySection, typeof UsersRound> = {
  clients: UsersRound,
  templates: LayoutTemplate,
  activity: Activity,
  systemSettings: Settings2,
};

function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/clients"
      onClick={onNavigate}
      className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4"
      aria-label="Launchpad home"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Rocket className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-none">
          Launchpad
        </span>
        <span className="mt-1 block truncate text-[11px] leading-none text-muted-foreground">
          Website Factory
        </span>
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const active = getPrimarySection(location);

  return (
    <nav className="flex shrink-0 flex-col gap-4 px-2" aria-label="Sections">
      {SECTION_GROUPS.map(group => (
        <div key={group}>
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {SECTION_GROUP_LABELS[group]}
          </p>
          <div className="flex flex-col gap-0.5">
            {sectionsInGroup(group).map(item => {
              const Icon = SECTION_ICONS[item.section];
              const selected = active === item.section;
              return (
                <Link
                  key={item.section}
                  href={item.path}
                  onClick={onNavigate}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    selected
                      ? "bg-sidebar-accent text-primary"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {item.availability === "deferred" ? (
                    <span
                      className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                      title="Designed, not enabled in this phase"
                    >
                      Soon
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * Account footer. Launchpad is reached directly today, so this states the access
 * model instead of inventing an operator identity.
 */
function AccountPanel() {
  return (
    <div className="shrink-0 border-t border-sidebar-border p-2">
      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          <UserRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">
            Direct access
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            No account sign-in yet
          </span>
        </span>
        <span
          className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          title="Accounts and roles are designed, not enabled in this phase"
        >
          Soon
        </span>
      </div>
    </div>
  );
}

function ClientTabBar({ clientId }: { clientId: number }) {
  const [location] = useLocation();
  const activeTab = getClientTab(location, getWorkspaceArea(location));

  return (
    <nav
      className="flex items-stretch gap-1 overflow-x-auto px-3 sm:px-5"
      aria-label="Client sections"
    >
      {CLIENT_TAB_LIST.map(tab => {
        const selected = activeTab === tab.tab;
        return (
          <Link
            key={tab.tab}
            href={clientTabHref(tab.tab, clientId)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-opacity",
              selected
                ? "text-primary after:bg-primary after:opacity-100"
                : "text-muted-foreground after:opacity-0 hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.availability === "deferred" ? (
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                title="Designed, not enabled in this phase"
              >
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Names the client the workspace is acting on; switching happens in the sidebar. */
function CurrentClient() {
  const { selectedClient, selectedClientId } = useWorkspace();

  if (!selectedClient || !selectedClientId) return null;

  return (
    <Link
      href={workspaceRoute("overview", selectedClientId)}
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/70"
    >
      <ClientAvatar name={selectedClient.client.businessName} />
      <span className="min-w-0">
        <span className="block text-[11px] leading-none text-muted-foreground">
          Current client
        </span>
        <span className="mt-1 block truncate text-sm font-semibold leading-none">
          {selectedClient.client.businessName}
        </span>
      </span>
      <StatusPill
        tone={clientStatusTone(selectedClient.operationalSummary.status)}
        label={selectedClient.operationalSummary.statusLabel}
        className="hidden sm:inline-flex"
      />
    </Link>
  );
}

function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { selectedClient, selectedClientId } = useWorkspace();
  const [location] = useLocation();
  const clientScoped = isClientScopedLocation(location);

  const previewUrl =
    selectedClient?.operationalSummary.liveUrl || selectedClient?.client.websiteUrl;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-card",
        clientScoped ? "border-b border-border" : "border-b border-border lg:border-b-0",
      )}
    >
      {clientScoped ? (
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
          <button
            type="button"
            onClick={onOpenNav}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <CurrentClient />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {previewUrl ? (
              <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Preview website</span>
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 text-xs font-semibold"
                onClick={() =>
                  toast.info("This client has no preview or website address yet.")
                }
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Preview website</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-semibold"
                >
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href="/clients/new">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New client
                  </Link>
                </DropdownMenuItem>
                {selectedClientId ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={configurationRoute(selectedClientId)}>
                        <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                        Configuration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={workspaceRoute("integrations", selectedClientId)}>
                        <Signal className="mr-2 h-4 w-4" aria-hidden="true" />
                        Integrations
                      </Link>
                    </DropdownMenuItem>
                    {previewUrl ? (
                      <DropdownMenuItem asChild>
                        <a href={previewUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                          Open live site
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="flex h-14 items-center px-3 lg:hidden">
          <button
            type="button"
            onClick={onOpenNav}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {clientScoped && selectedClientId ? (
        <ClientTabBar clientId={selectedClientId} />
      ) : null}
    </header>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const clientScoped = isClientScopedLocation(location);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-3">
        <SidebarNav onNavigate={onNavigate} />
        {clientScoped ? <ClientDirectory onNavigate={onNavigate} /> : null}
      </div>
      <AccountPanel />
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="launchpad-sidebar hidden h-screen w-64 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex">
          <Wordmark />
          <SidebarBody />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenNav={() => setDrawerOpen(true)} />
          <main className="launchpad-workspace min-w-0 flex-1 p-3 sm:p-4 lg:px-5 lg:py-5">
            {children}
          </main>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="launchpad-sidebar h-full w-[min(17rem,88vw)] p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-sidebar-border pr-2">
              <Wordmark onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
