import { z } from "zod";
import {
  CANONICAL_OFFLINE_CONVERSION_CONTRACT,
  PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
  PAID_FUNNEL_KIND,
  PAID_FUNNEL_SECTION_PRESETS,
  PAID_FUNNEL_STEP_TYPES,
  paidFunnelGraphSchema,
  type PaidFunnelGraph,
} from "./graph";

export const PAID_FUNNEL_PACKAGE_SCHEMA_VERSION = 1 as const;
export const PAID_FUNNEL_ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const PAID_FUNNEL_ZIP_MAX_FILES = 2000;
export const PAID_FUNNEL_FRAMEWORK_VALUES = ["static-html", "astro", "unknown"] as const;
export type PaidFunnelFramework = (typeof PAID_FUNNEL_FRAMEWORK_VALUES)[number];
export const PAID_FUNNEL_PUBLISH_ADAPTER_VALUES = ["generic-paid-funnel", "legacy-simple-form"] as const;
export type PaidFunnelPublishAdapter = (typeof PAID_FUNNEL_PUBLISH_ADAPTER_VALUES)[number];

export type ZipIntakeFile = { path: string; size: number };
export type ZipIntakeError = { code: string; message: string; path?: string };
export type ZipIntakeResult =
  | { ok: true; files: ZipIntakeFile[]; totalBytes: number }
  | { ok: false; errors: ZipIntakeError[] };
export type PackageDetectResult =
  | { status: "ready"; framework: PaidFunnelFramework; hasExplicitManifest: boolean }
  | { status: "draft"; framework: PaidFunnelFramework; hasExplicitManifest: boolean; unsupportedRegions: string[] };

export function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

export function isUnsafeArchivePath(path: string): boolean {
  const normalized = normalizeZipPath(path);
  return normalized.startsWith("/") || normalized.split("/").includes("..");
}

export function isBlockedSecretName(path: string): boolean {
  const base = normalizeZipPath(path).split("/").pop()?.toLowerCase() ?? "";
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base === "credentials.json" ||
    base.endsWith(".pem") ||
    base.endsWith(".key")
  );
}

export function isBlockedBinaryName(path: string): boolean {
  const base = normalizeZipPath(path).toLowerCase();
  return [".exe", ".bat", ".cmd", ".sh", ".dll", ".so", ".bin", ".msi"].some(ext => base.endsWith(ext));
}

export function validatePaidFunnelZipIntake(
  files: ZipIntakeFile[],
  options?: { archiveName?: string; archiveBytes?: number },
): ZipIntakeResult {
  const errors: ZipIntakeError[] = [];
  const archiveName = options?.archiveName ?? "";
  if (archiveName && !archiveName.toLowerCase().endsWith(".zip")) {
    errors.push({ code: "not-zip", message: "Import accepts a .zip package only.", path: archiveName });
  }
  if ((options?.archiveBytes ?? 0) > PAID_FUNNEL_ZIP_MAX_BYTES) {
    errors.push({ code: "too-large", message: "Archive exceeds the 50MB intake limit." });
  }
  if (files.length > PAID_FUNNEL_ZIP_MAX_FILES) {
    errors.push({ code: "too-many-files", message: "Archive exceeds the 2000 file intake limit." });
  }
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (isUnsafeArchivePath(file.path)) {
      errors.push({ code: "path-traversal", message: `Unsafe path: ${file.path}`, path: file.path });
    }
    if (isBlockedSecretName(file.path)) {
      errors.push({ code: "credential-file", message: `Secret-named file blocked: ${file.path}`, path: file.path });
    }
    if (isBlockedBinaryName(file.path)) {
      errors.push({ code: "executable", message: `Binary file blocked: ${file.path}`, path: file.path });
    }
  }
  if (totalBytes > PAID_FUNNEL_ZIP_MAX_BYTES) {
    errors.push({ code: "too-large", message: "Archive contents exceed the 50MB intake limit." });
  }
  return errors.length ? { ok: false, errors } : { ok: true, files, totalBytes };
}

export function detectPaidFunnelPackage(files: ZipIntakeFile[]): PackageDetectResult {
  const paths = files.map(file => normalizeZipPath(file.path).toLowerCase());
  const rootManifest = paths.includes("launchpad.template.json");
  const nestedManifest = paths.some(path => path.endsWith("launchpad.template.json") && path !== "launchpad.template.json");
  const hasHtml = paths.some(path => path.endsWith(".html") || path.endsWith(".htm"));
  const hasAstro = paths.some(path => path.endsWith(".astro") || path.endsWith("astro.config.ts") || path.endsWith("astro.config.mjs"));
  const framework: PaidFunnelFramework = hasAstro ? "astro" : hasHtml ? "static-html" : "unknown";
  const unsupportedRegions: string[] = [];
  if (!rootManifest && !nestedManifest && !hasHtml && !hasAstro) {
    unsupportedRegions.push("package: missing launchpad.template.json and no HTML/Astro entry to auto-detect");
  }
  if (!rootManifest && nestedManifest) {
    unsupportedRegions.push("manifest: launchpad.template.json must sit at the archive root");
  }
  if (framework === "unknown" && rootManifest) {
    unsupportedRegions.push("graph: package cannot become a visual Page→Section→Row→Column→Element graph");
  }
  if (unsupportedRegions.length) {
    return { status: "draft", framework, hasExplicitManifest: rootManifest, unsupportedRegions };
  }
  return { status: "ready", framework, hasExplicitManifest: rootManifest };
}

export type PaidFunnelPackageInput = Record<string, unknown>;

const packageStepSchema = z.object({
  key: z.string().min(1),
  type: z.enum(PAID_FUNNEL_STEP_TYPES),
  slug: z.string().min(1),
  title: z.string().min(1),
  seo: z.object({ title: z.string().optional(), description: z.string().optional(), shareImage: z.string().optional() }).optional(),
  nextStep: z.string().optional(),
});

export const paidFunnelPackageSchema = z.object({
  schemaVersion: z.literal(PAID_FUNNEL_PACKAGE_SCHEMA_VERSION),
  templateKey: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  kind: z.literal(PAID_FUNNEL_KIND),
  framework: z.enum(PAID_FUNNEL_FRAMEWORK_VALUES),
  steps: z.array(packageStepSchema).min(1),
  previewEntry: z.string().min(1),
  graph: paidFunnelGraphSchema.optional(),
  sectionPresets: z.array(z.enum(PAID_FUNNEL_SECTION_PRESETS)).optional(),
  integrations: z.array(z.string()).optional(),
  requiredRuntimeSecrets: z.array(z.string().min(1)).optional(),
  readinessRules: z.array(z.string()).optional(),
  build: z.object({ command: z.string().min(1), outputDir: z.string().min(1) }),
  publishAdapter: z.enum(PAID_FUNNEL_PUBLISH_ADAPTER_VALUES),
  resources: z.array(z.string()).optional(),
  offlineConversionContract: z.unknown().optional(),
});

export type PaidFunnelPackage = z.infer<typeof paidFunnelPackageSchema>;

export function parsePaidFunnelManifest(input: unknown): PaidFunnelPackage {
  return paidFunnelPackageSchema.parse(input);
}
