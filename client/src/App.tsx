import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import {
  campaignsRedirectFromLegacyPath,
  configurationRoute,
  launchRoute,
  workspaceRoute,
} from "@/lib/workspaceNavigation";
import { Redirect, Route, Switch } from "wouter";
import AppShell from "./app/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import ActivityPage from "./features/activity/ActivityPage";
import DeferredCampaignsPage from "./features/campaigns/DeferredCampaignsPage";
import ClientOverviewPage from "./features/clients/ClientOverviewPage";
import ClientsPage from "./features/clients/ClientsPage";
import ClientIntegrationsPage from "./features/integrations/ClientIntegrationsPage";
import LaunchPage from "./features/launch/LaunchPage";
import DeferredSettingsPage from "./features/settings/DeferredSettingsPage";
import InventoryPage from "./features/inventory/InventoryPage";
import PagesManagerPage from "./features/website/PagesManagerPage";
import AstroClientEditor from "./pages/AstroClientEditor";
import DraftClientCreate from "./pages/DraftClientCreate";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/clients" />
      </Route>

      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/new">
        <DraftClientCreate />
      </Route>
      <Route path="/clients/:clientId">
        {params => <Redirect to={`/workspace/${Number(params.clientId)}`} />}
      </Route>

      <Route path="/templates">
        <DeferredSettingsPage section="templates" />
      </Route>
      <Route path="/activity" component={ActivityPage} />

      <Route path="/system-settings">
        <DeferredSettingsPage section="systemSettings" />
      </Route>

      <Route path="/workspace/:clientId/pages">
        {params => (
          <PagesManagerPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/inventory">
        {params => (
          <InventoryPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/campaigns">
        {params => (
          <DeferredCampaignsPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/funnels">
        {params => (
          <Redirect
            to={
              campaignsRedirectFromLegacyPath(
                `/workspace/${Number(params.clientId)}/funnels`,
                window.location.search,
              ) ?? workspaceRoute("campaigns", Number(params.clientId))
            }
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/configuration">
        {params => (
          <AstroClientEditor
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/media">
        {params => (
          <Redirect to={configurationRoute(Number(params.clientId), "media")} />
        )}
      </Route>
      <Route path="/workspace/:clientId/settings">
        {params => <Redirect to={configurationRoute(Number(params.clientId))} />}
      </Route>
      <Route path="/workspace/:clientId/integrations">
        {params => (
          <ClientIntegrationsPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId/preview-qa">
        {params => <Redirect to={launchRoute(Number(params.clientId))} />}
      </Route>
      <Route path="/workspace/:clientId/launch">
        {params => (
          <LaunchPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path="/workspace/:clientId">
        {params => (
          <ClientOverviewPage
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <AppShell>
          <Router />
        </AppShell>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
