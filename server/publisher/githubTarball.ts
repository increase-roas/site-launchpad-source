import { gunzipSync } from "node:zlib";

const BLOCK = 512;
const TEXT = /\.(astro|ts|tsx|js|mjs|cjs|css|json|md|toml|yml|yaml|svg|html|txt)$/i;
const MAX_TEXT_BYTES = 256_000;

function readCString(block: Buffer, start: number, length: number): string {
  const slice = block.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? length : end).toString("utf8");
}

function isZeroBlock(block: Buffer): boolean {
  for (const byte of block) {
    if (byte !== 0) return false;
  }
  return true;
}

function stripArchiveRoot(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const slash = normalized.indexOf("/");
  return slash === -1 ? "" : normalized.slice(slash + 1);
}

export function parseGzipTarTextFiles(
  archive: Buffer,
): Array<{ path: string; content: string }> {
  const tar = gunzipSync(archive);
  const files: Array<{ path: string; content: string }> = [];
  let offset = 0;
  let pendingLongName: string | null = null;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) break;
    const size = parseInt(readCString(header, 124, 12), 8) || 0;
    const typeflag = header[156];
    const prefix = readCString(header, 345, 155);
    const name = readCString(header, 0, 100);
    const fullName = pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
    pendingLongName = null;
    offset += BLOCK;
    const data = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / BLOCK) * BLOCK;
    if (typeflag === 0x4c) {
      pendingLongName = data.toString("utf8").replace(/\0+$/, "");
      continue;
    }
    if (typeflag === 0x78 || typeflag === 0x67 || typeflag === 0x35) continue;
    if (typeflag !== 0 && typeflag !== 0x30) continue;
    const path = stripArchiveRoot(fullName);
    if (!path || !TEXT.test(path) || data.length > MAX_TEXT_BYTES) continue;
    files.push({ path, content: data.toString("utf8") });
  }
  return files;
}
