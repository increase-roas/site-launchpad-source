import {
  configurationRoute,
  launchRoute,
  workspaceRoute,
} from "@/lib/workspaceNavigation";
import type { WizardStep } from "./wizard";

/** Where each build step lives for a given client. */
export function wizardStepHref(step: WizardStep, clientId: number): string {
  switch (step) {
    case "clientSetup":
      return workspaceRoute("overview", clientId);
    case "brandContent":
      return configurationRoute(clientId, "content");
    case "mediaGallery":
      return configurationRoute(clientId, "media");
    case "pages":
      return workspaceRoute("pages", clientId);
    case "funnels":
      return workspaceRoute("campaigns", clientId);
    case "integrations":
      return workspaceRoute("integrations", clientId);
    case "launch":
      return launchRoute(clientId);
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export function wizardHrefFactory(
  clientId: number,
): (step: WizardStep) => string {
  return step => wizardStepHref(step, clientId);
}
