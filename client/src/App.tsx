import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ClientEditor from "./pages/ClientEditor";
import AstroClientEditor from "./pages/AstroClientEditor";
import Home from "./pages/Home";
import MediaWorkspace from "./pages/MediaWorkspace";
import PaidAdsWorkspace from "./pages/PaidAdsWorkspace";
import WebsiteWorkspace from "./pages/WebsiteWorkspace";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/clients/new">
        <ClientEditor />
      </Route>
      <Route path="/clients/:clientId">
        {params => <ClientEditor clientId={Number(params.clientId)} />}
      </Route>
      <Route path="/workspace/:clientId/pages">
        {params => <WebsiteWorkspace clientId={Number(params.clientId)} />}
      </Route>
      <Route path="/workspace/:clientId/funnels">
        {params => <PaidAdsWorkspace clientId={Number(params.clientId)} />}
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
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
