import { clientSiteHost } from "@/lib/clientBoard";
import {
  isWorkersDevUrl,
  liveHostnameFromSiteUrl,
  parseHostnameAttachedToOtherWorker,
} from "@shared/liveSiteHostname";

export type LiveDomainConnectDialog =
  | {
      kind: "ready";
      hostname: string;
      title: string;
      description: string;
      confirmLabel: string;
    }
  | {
      kind: "blocked";
      title: string;
      description: string;
    };

export function publishStartLabel(
  publish: { liveUrl?: string | null } | null | undefined,
): string {
  if (!publish) return "Publish";
  return isWorkersDevUrl(publish.liveUrl) ? "Connect live domain" : "Publish again";
}

export function liveDomainConnectDialog(input: {
  siteUrl: string | null | undefined;
  currentLiveUrl: string | null | undefined;
}): LiveDomainConnectDialog {
  const siteUrl = input.siteUrl?.trim() ?? "";
  if (!siteUrl) {
    return {
      kind: "blocked",
      title: "Cannot connect live domain",
      description:
        "Set a HTTPS Site URL in Basic Info and save it before connecting the live domain.",
    };
  }

  let hostname: string;
  try {
    hostname = liveHostnameFromSiteUrl(siteUrl);
  } catch (error) {
    return {
      kind: "blocked",
      title: "Cannot connect live domain",
      description:
        error instanceof Error
          ? error.message
          : "Site URL is not a valid live domain.",
    };
  }

  const currentHost = clientSiteHost(input.currentLiveUrl);
  return {
    kind: "ready",
    hostname,
    title: "Connect live domain",
    description: currentHost
      ? `Attach ${hostname} to this production Worker? Production is currently on ${currentHost}.`
      : `Attach ${hostname} to this production Worker?`,
    confirmLabel: `Connect ${hostname}`,
  };
}

export function customDomainConflictDialog(error: string | null | undefined): {
  hostname: string;
  otherWorkerName: string;
  title: string;
  description: string;
  reviewLabel: string;
  confirmLabel: string;
} | null {
  const conflict = parseHostnameAttachedToOtherWorker(error);
  if (!conflict) return null;
  return {
    ...conflict,
    title: "This domain is already live on another Worker",
    description:
      `${conflict.hostname} is attached to Worker "${conflict.otherWorkerName}". ` +
      "Moving it here takes that hostname off the other site. " +
      "If this client's Site URL is wrong, review Basic Info instead.",
    reviewLabel: "Review Site URL",
    confirmLabel: "Move domain and continue",
  };
}
