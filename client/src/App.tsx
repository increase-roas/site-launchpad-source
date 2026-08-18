import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthCallback from "./pages/AuthCallback";
import AstroClientEditor from "./pages/AstroClientEditor";
import DraftClientCreate from "./pages/DraftClientCreate";
import Home from "./pages/Home";
import MediaWorkspace from "./pages/MediaWorkspace";
import PaidAdsWorkspace from "./pages/PaidAdsWorkspace";
import WebsiteWorkspace from "./pages/WebsiteWorkspace";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/clients/new">
        <DraftClientCreate />
      </Route>
      <Route path="/clients/:clientId">
        {params => <Redirect to={`/workspace/${Number(params.clientId)}/settings`} />}
      </Route>
      <Route path="/workspace/:clientId/pages">
        {params => (
          <WebsiteWorkspace key={Number(params.clientId)} clientId={Number(params.clientId)} />
        )}
      </Route>
      <Route path="/workspace/:clientId/funnels">
        {params => (
          <PaidAdsWorkspace key={Number(params.clientId)} clientId={Number(params.clientId)} />
        )}
      </Route>
      <Route path="/workspace/:clientId/media">
        {params => <MediaWorkspace clientId={Number(params.clientId)} />}
      </Route>
      <Route path="/workspace/:clientId/settings">
        {params => (
          <AstroClientEditor
            key={Number(params.clientId)}
            clientId={Number(params.clientId)}
          />
        )}
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/auth/callback" component={AuthCallback} />
            <Route>
              <DashboardLayout>
                <Router />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
