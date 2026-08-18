import { crc32, inflateRawSync } from "node:zlib";
import {
  PAID_FUNNEL_KIND,
  PAID_FUNNEL_SCHEMA_VERSION,
  parsePaidFunnelPackage,
  type PaidFunnelFramework,
  type PaidFunnelPackage,
  type PaidFunnelPackageIntake,
  type PaidFunnelUnsupportedRegionError,
} from "./paidFunnelContract";
import { PAID_FUNNEL_SECTION_PRESETS } from "./paidFunnelGraph";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "./simpleFormContract";

export const PAID_FUNNEL_ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const PAID_FUNNEL_ZIP_MAX_FILES = 2000;
export const LAUNCHPAD_TEMPLATE_FILENAME = "launchpad.template.json";

export type ZipEntry = {
  path: string;
  data: Buffer;
};

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CREDENTIAL_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".npmrc",
  ".netrc",
  ".htpasswd",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials.json",
  "secrets.json",
  "service-account.json",
]);

const CREDENTIAL_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".jks",
  ".keystore",
]);

const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".sh",
  ".bash",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".deb",
  ".rpm",
  ".app",
]);

const EXECUTABLE_MAGIC = [
  Buffer.from([0x4d, 0x5a]),
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  Buffer.from([0xcf, 0xfa, 0xed, 0xfe]),
  Buffer.from([0xca, 0xfe, 0xba, 0xbe]),
];

export class PaidFunnelZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaidFunnelZipError";
  }
}

function readU16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readU32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function writeU16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeU32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function assertSafeZipPath(path: string): string {
  const normalized = normalizeZipPath(path);
  if (!normalized || normalized.endsWith("/")) {
    throw new PaidFunnelZipError(`Invalid zip entry path "${path}".`);
  }
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.split("/").includes("..") ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new PaidFunnelZipError(`Zip path traversal rejected: "${path}".`);
  }
  return normalized;
}

function basename(path: string): string {
  const parts = normalizeZipPath(path).split("/");
  return parts[parts.length - 1] ?? path;
}

function extension(path: string): string {
  const name = basename(path).toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

export function classifyRejectedZipFile(
  path: string,
  data: Buffer
): string | null {
  const name = basename(path);
  const lower = name.toLowerCase();
  if (CREDENTIAL_FILE_NAMES.has(lower) || lower.startsWith(".env.")) {
    return `Credential file rejected: "${path}".`;
  }
  if (CREDENTIAL_EXTENSIONS.has(extension(path))) {
    return `Credential file rejected: "${path}".`;
  }
  if (EXECUTABLE_EXTENSIONS.has(extension(path))) {
    return `Executable file rejected: "${path}".`;
  }
  if (data.subarray(0, 2).toString() === "#!") {
    return `Executable file rejected: "${path}".`;
  }
  for (const magic of EXECUTABLE_MAGIC) {
    if (data.subarray(0, magic.length).equals(magic)) {
      return `Executable file rejected: "${path}".`;
    }
  }
  return null;
}

export function createStoreZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const path = assertSafeZipPath(entry.path);
    const name = Buffer.from(path, "utf8");
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data);
    const checksum = crc32(data) >>> 0;
    const local = Buffer.concat([
      writeU32(LOCAL_SIG),
      writeU16(20),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(checksum),
      writeU32(data.length),
      writeU32(data.length),
      writeU16(name.length),
      writeU16(0),
      name,
      data,
    ]);
    const central = Buffer.concat([
      writeU32(CENTRAL_SIG),
      writeU16(20),
      writeU16(20),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(checksum),
      writeU32(data.length),
      writeU32(data.length),
      writeU16(name.length),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(0),
      writeU32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    writeU32(EOCD_SIG),
    writeU16(0),
    writeU16(0),
    writeU16(entries.length),
    writeU16(entries.length),
    writeU32(centralDir.length),
    writeU32(offset),
    writeU16(0),
  ]);
  return Buffer.concat([...locals, centralDir, eocd]);
}

export function parseStoreZip(buffer: Buffer): ZipEntry[] {
  if (buffer.length > PAID_FUNNEL_ZIP_MAX_BYTES) {
    throw new PaidFunnelZipError(
      `Zip exceeds ${PAID_FUNNEL_ZIP_MAX_BYTES} bytes.`
    );
  }
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = readU32(buffer, offset);
    if (signature !== LOCAL_SIG) break;
    const compression = readU16(buffer, offset + 8);
    const compressedSize = readU32(buffer, offset + 18);
    const uncompressedSize = readU32(buffer, offset + 22);
    const nameLength = readU16(buffer, offset + 26);
    const extraLength = readU16(buffer, offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) {
      throw new PaidFunnelZipError("Zip local file is truncated.");
    }
    const path = buffer.subarray(nameStart, nameEnd).toString("utf8");
    if (path.endsWith("/")) {
      offset = dataEnd;
      continue;
    }
    const raw = buffer.subarray(dataStart, dataEnd);
    const data =
      compression === 0
        ? Buffer.from(raw)
        : compression === 8
          ? inflateRawSync(raw, { maxOutputLength: uncompressedSize })
          : (() => {
              throw new PaidFunnelZipError(
                `Unsupported zip compression ${compression} for "${path}".`
              );
            })();
    entries.push({ path: assertSafeZipPath(path), data });
    offset = dataEnd;
  }
  if (entries.length === 0) {
    throw new PaidFunnelZipError("Zip contains no files.");
  }
  if (entries.length > PAID_FUNNEL_ZIP_MAX_FILES) {
    throw new PaidFunnelZipError(
      `Zip exceeds ${PAID_FUNNEL_ZIP_MAX_FILES} files.`
    );
  }
  return entries;
}

export function inspectPaidFunnelZip(buffer: Buffer): ZipEntry[] {
  if (buffer.length > PAID_FUNNEL_ZIP_MAX_BYTES) {
    throw new PaidFunnelZipError(
      `Zip exceeds ${PAID_FUNNEL_ZIP_MAX_BYTES} bytes.`
    );
  }
  const entries = parseStoreZip(buffer);
  for (const entry of entries) {
    const rejected = classifyRejectedZipFile(entry.path, entry.data);
    if (rejected) throw new PaidFunnelZipError(rejected);
  }
  return entries;
}

const UNSUPPORTED_HTML = [
  {
    match: /<script\b/i,
    reason: "Inline or linked script is not a visual graph element.",
  },
  { match: /<iframe\b/i, reason: "iframe is an unsupported region." },
  { match: /<object\b/i, reason: "object is an unsupported region." },
  { match: /<embed\b/i, reason: "embed is an unsupported region." },
  { match: /<canvas\b/i, reason: "canvas is an unsupported region." },
  {
    match: /<[a-z][a-z0-9]*-[a-z0-9-]+/i,
    reason: "Custom element is an unsupported region.",
  },
];

function detectFramework(paths: string[]): PaidFunnelFramework {
  if (
    paths.some(
      path =>
        /(^|\/)astro\.config\.(js|mjs|cjs|ts)$/.test(path) ||
        path.includes("src/pages/")
    )
  ) {
    return "astro";
  }
  if (paths.some(path => path.endsWith(".html"))) {
    return "static-html";
  }
  return "unknown";
}

function collectUnsupportedRegions(
  entries: ZipEntry[]
): PaidFunnelUnsupportedRegionError[] {
  const errors: PaidFunnelUnsupportedRegionError[] = [];
  for (const entry of entries) {
    if (!entry.path.endsWith(".html") && !entry.path.endsWith(".astro")) {
      continue;
    }
    const source = entry.data.toString("utf8");
    for (const rule of UNSUPPORTED_HTML) {
      if (rule.match.test(source)) {
        errors.push({ path: entry.path, reason: rule.reason });
      }
    }
  }
  return errors;
}

function defaultSectionPresets() {
  return PAID_FUNNEL_SECTION_PRESETS.map(key => ({
    key,
    name: key.replace(/-/g, " "),
  }));
}

function draftPackageFromDetection(
  framework: PaidFunnelFramework,
  entries: ZipEntry[],
  unsupportedRegions: PaidFunnelUnsupportedRegionError[]
): PaidFunnelPackage {
  const html = entries.find(entry => entry.path.endsWith(".html"));
  const previewEntry = html?.path ?? entries[0]?.path ?? "index.html";
  const editableSlots = html
    ? [
        {
          id: "slot-body",
          path: html.path,
          label: "Document body",
        },
      ]
    : [];
  const immutableRegions = unsupportedRegions.map((error, index) => ({
    id: `unsupported-${index + 1}`,
    path: error.path,
    reason: error.reason,
  }));

  return parsePaidFunnelPackage({
    schemaVersion: PAID_FUNNEL_SCHEMA_VERSION,
    templateKey: "imported-paid-funnel",
    name: "Imported Paid Funnel",
    version: "0.0.0-draft",
    kind: PAID_FUNNEL_KIND,
    framework,
    steps: [
      {
        key: "landing",
        type: "landing",
        slug: "landing",
        title: "Landing",
        seo: { title: "Landing" },
        nextStep: "form",
      },
      {
        key: "form",
        type: "form",
        slug: "form",
        title: "Form",
        seo: { title: "Form" },
        nextStep: "thank-you",
      },
      {
        key: "thank-you",
        type: "thankYou",
        slug: "thank-you",
        title: "Thank You",
        seo: { title: "Thank You" },
      },
    ],
    previewEntry,
    immutableRegions:
      immutableRegions.length > 0
        ? immutableRegions
        : [
            {
              id: "region-document",
              path: previewEntry,
              reason: "Imported markup is treated as an immutable region.",
            },
          ],
    editableSlots:
      editableSlots.length > 0
        ? editableSlots
        : [
            {
              id: "slot-document",
              path: previewEntry,
              label: "Imported document",
            },
          ],
    sectionPresets: defaultSectionPresets(),
    assets: [],
    configSchema: {},
    defaults: {},
    integrations: [],
    requiredRuntimeSecrets: [
      ...SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets,
    ],
    readinessRules: [
      {
        id: "package",
        description: "Package contract is valid.",
        check: "package",
      },
    ],
    build: { command: "echo skip", outputDir: "dist" },
    publishAdapter: "generic-paid-funnel",
    resources: [],
    offlineConversionContract: SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  });
}

export function ingestPaidFunnelZip(buffer: Buffer): PaidFunnelPackageIntake {
  const entries = inspectPaidFunnelZip(buffer);
  const manifest = entries.find(
    entry => basename(entry.path) === LAUNCHPAD_TEMPLATE_FILENAME
  );
  if (manifest) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifest.data.toString("utf8"));
    } catch {
      return {
        status: "draft",
        pkg: null,
        unsupportedRegions: [
          {
            path: manifest.path,
            reason: "launchpad.template.json is not valid JSON.",
          },
        ],
      };
    }
    try {
      const pkg = parsePaidFunnelPackage(parsed);
      return { status: "ready", pkg, unsupportedRegions: [] };
    } catch (error) {
      return {
        status: "draft",
        pkg: null,
        unsupportedRegions: [
          {
            path: manifest.path,
            reason:
              error instanceof Error
                ? error.message
                : "launchpad.template.json failed package validation.",
          },
        ],
      };
    }
  }

  const framework = detectFramework(entries.map(entry => entry.path));
  const unsupportedRegions = collectUnsupportedRegions(entries);
  if (framework === "unknown" && unsupportedRegions.length === 0) {
    unsupportedRegions.push({
      path: entries[0]?.path ?? ".",
      reason: "Could not auto-detect HTML or Astro sources for a visual graph.",
    });
  }
  const pkg = draftPackageFromDetection(framework, entries, unsupportedRegions);
  return {
    status: unsupportedRegions.length > 0 ? "draft" : "draft",
    pkg,
    unsupportedRegions:
      unsupportedRegions.length > 0
        ? unsupportedRegions
        : [
            {
              path: pkg.previewEntry,
              reason:
                "Auto-detected package cannot become a visual graph without launchpad.template.json.",
            },
          ],
  };
}
