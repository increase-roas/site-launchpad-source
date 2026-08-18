import { SIMPLE_FORM_TEMPLATE_KEY } from "../simpleFormContract";

export const PAID_ADS_FUNNEL_TABS = ["templates", "mine"] as const;
export type PaidAdsFunnelTab = (typeof PAID_ADS_FUNNEL_TABS)[number];

export type PaidAdsFunnelView = "templates" | "mine" | "builder" | "simple-form" | "legacy";

export function paidAdsFunnelsPath(clientId: number): string {
  return `/workspace/${clientId}/funnels`;
}

export function paidAdsLibraryPath(clientId: number, tab: PaidAdsFunnelTab): string {
  return `${paidAdsFunnelsPath(clientId)}?tab=${tab}`;
}

export function paidAdsBuilderPath(clientId: number, funnelKey: string): string {
  return `${paidAdsFunnelsPath(clientId)}?studio=${encodeURIComponent(funnelKey)}`;
}

export function paidAdsSimpleFormPath(clientId: number, funnelId: number): string {
  return `${paidAdsFunnelsPath(clientId)}?funnel=${funnelId}`;
}

export function parsePaidAdsFunnelSearch(search: string): {
  tab: PaidAdsFunnelTab;
  studioKey: string | null;
  funnelId: number | null;
  view: PaidAdsFunnelView;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab") === "mine" ? "mine" : "templates";
  const studioKey = params.get("studio");
  const funnelRaw = Number(params.get("funnel"));
  const funnelId = Number.isInteger(funnelRaw) && funnelRaw > 0 ? funnelRaw : null;
  let view: PaidAdsFunnelView = tab;
  if (studioKey) view = "builder";
  else if (funnelId) view = "simple-form";
  return { tab, studioKey, funnelId, view };
}

export function paidAdsFunnelBreadcrumbs(clientName: string, search: string): string[] {
  const parsed = parsePaidAdsFunnelSearch(search);
  const base = [clientName, "Paid Ads", "Funnels"];
  if (parsed.view === "builder") return [...base, "Builder"];
  if (parsed.view === "mine") return [...base, "My Funnels"];
  if (parsed.view === "templates") return [...base, "Templates"];
  return base;
}

export function isWebsiteTemplatesRoute(path: string): boolean {
  return path === "/templates" || path.startsWith("/templates/");
}

export const ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const ZIP_MAX_FILES = 2000;
const CREDENTIAL_RE = /(^|\/)(\.env(\.|$)|.*credentials.*|id_rsa|.*\.(pem|p12|key))$/i;
const EXECUTABLE_RE = /\.(exe|dll|so|dylib|bin|sh|bat|cmd|ps1)$/i;
const TRAVERSAL_RE = /(^|\/)\.\.(\/|$)/;

export type ZipListedFile = { path: string; byteSize: number; executable?: boolean };
export type ZipIntakeStatus = "accepted" | "draft" | "rejected";
export type ZipIntakeResult = {
  status: ZipIntakeStatus;
  framework: "static-html" | "astro" | "unknown" | null;
  errors: string[];
  kind?: "paid-funnel";
};

export function inspectPaidFunnelZipIntake(input: {
  archiveName: string;
  byteSize: number;
  files: ZipListedFile[];
  manifest?: { kind?: string; graph?: unknown; immutableRegions?: unknown[] };
}): ZipIntakeResult {
  const errors: string[] = [];
  if (!input.archiveName.toLowerCase().endsWith(".zip")) errors.push("Upload a .zip archive.");
  if (input.byteSize > ZIP_MAX_BYTES) errors.push("Archive exceeds 50MB.");
  if (input.files.length > ZIP_MAX_FILES) errors.push("Archive exceeds 2000 files.");
  for (const file of input.files) {
    if (TRAVERSAL_RE.test(file.path)) errors.push(`Path traversal is not allowed: ${file.path}`);
    if (CREDENTIAL_RE.test(file.path)) errors.push(`Credential file is not allowed: ${file.path}`);
    if (file.executable || EXECUTABLE_RE.test(file.path)) errors.push(`Executable is not allowed: ${file.path}`);
  }
  if (errors.length) return { status: "rejected", framework: null, errors };

  const names = input.files.map(file => file.path.replace(/^\.\//, ""));
  const hasManifest = names.some(name => name === "launchpad.template.json" || name.endsWith("/launchpad.template.json"));
  if (hasManifest) {
    if (input.manifest && input.manifest.kind && input.manifest.kind !== "paid-funnel") {
      return { status: "rejected", framework: null, errors: ['launchpad.template.json kind must be "paid-funnel".'] };
    }
    if (input.manifest?.immutableRegions?.length && !input.manifest.graph) {
      return {
        status: "draft",
        framework: "unknown",
        kind: "paid-funnel",
        errors: input.manifest.immutableRegions.map(region => `Unsupported region cannot become a visual graph: ${String(region)}`),
      };
    }
    return { status: "accepted", framework: "unknown", kind: "paid-funnel", errors: [] };
  }
  const hasAstro = names.some(name => name.includes("astro.config"));
  const hasHtml = names.some(name => name.endsWith(".html"));
  if (hasAstro || hasHtml) {
    return {
      status: "draft",
      framework: hasAstro ? "astro" : "static-html",
      kind: "paid-funnel",
      errors: ["No launchpad.template.json; archive is a draft until it can become a visual graph."],
    };
  }
  return { status: "rejected", framework: null, errors: ["Archive cannot become a visual paid-funnel graph."] };
}

export function libraryItems() {
  return {
    simpleFormKey: SIMPLE_FORM_TEMPLATE_KEY,
    paidFunnelFixtureKey: "generic-paid-funnel",
    zipDropzone: "inside-paid-ads-funnels",
  };
}
