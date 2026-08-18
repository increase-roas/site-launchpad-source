import { PAID_FUNNEL_KIND } from "@shared/paidFunnel/graph";
import { GENERIC_PAID_FUNNEL_LIBRARY_CARD, createGenericPaidFunnelFixture } from "@shared/paidFunnel/fixture";
import {
  detectPaidFunnelPackage,
  validatePaidFunnelZipIntake,
  type PackageDetectResult,
  type ZipIntakeFile,
  type ZipIntakeResult,
} from "@shared/paidFunnel/package";

export const FUNNEL_LIBRARY_TABS = ["templates", "my-funnels"] as const;
export type FunnelLibraryTab = (typeof FUNNEL_LIBRARY_TABS)[number];
export type FunnelWorkspaceView = FunnelLibraryTab | "builder";

export const SITE_NAV_INCLUDES_TEMPLATES = false;
export const TEMPLATES_SITE_PATH = "/templates";

export function paidAdsFunnelsPath(clientId: number, view: FunnelWorkspaceView = "templates", funnelId?: string): string {
  const base = `/workspace/${clientId}/funnels`;
  if (view === "builder" && funnelId) return `${base}?builder=${encodeURIComponent(funnelId)}`;
  if (view === "my-funnels") return `${base}?tab=my-funnels`;
  return `${base}?tab=templates`;
}

export function parseFunnelWorkspaceView(search: string): { tab: FunnelLibraryTab; builderId: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const builderId = params.get("builder");
  const tab = params.get("tab") === "my-funnels" ? "my-funnels" : "templates";
  return { tab, builderId };
}

export function isTemplatesSiteNavPath(path: string): boolean {
  return path === TEMPLATES_SITE_PATH || path.startsWith(`${TEMPLATES_SITE_PATH}/`);
}

export type LocalPaidFunnelDraft = {
  id: string;
  clientId: number;
  name: string;
  templateKey: string;
  kind: typeof PAID_FUNNEL_KIND;
  createdAt: string;
};

export function libraryTemplates() {
  return [GENERIC_PAID_FUNNEL_LIBRARY_CARD];
}

export function createDraftFromFixture(clientId: number, now = new Date().toISOString()): {
  draft: LocalPaidFunnelDraft;
  graph: ReturnType<typeof createGenericPaidFunnelFixture>;
} {
  const graph = createGenericPaidFunnelFixture(`client${clientId}`);
  return {
    draft: {
      id: graph.funnelKey + "-" + clientId,
      clientId,
      name: graph.name,
      templateKey: GENERIC_PAID_FUNNEL_LIBRARY_CARD.templateKey,
      kind: PAID_FUNNEL_KIND,
      createdAt: now,
    },
    graph,
  };
}

export function intakeImportedArchive(
  files: ZipIntakeFile[],
  options?: { archiveName?: string; archiveBytes?: number },
): { intake: ZipIntakeResult; detect?: PackageDetectResult } {
  const intake = validatePaidFunnelZipIntake(files, options);
  if (!intake.ok) return { intake };
  return { intake, detect: detectPaidFunnelPackage(files) };
}

export function libraryFromRegistry<TTemplate extends { templateKey: string }, TFunnel extends { id: number }>(
  templates: TTemplate[],
  funnels: TFunnel[],
): { templates: TTemplate[]; funnels: TFunnel[] } {
  return { templates, funnels };
}
