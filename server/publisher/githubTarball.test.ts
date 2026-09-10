import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseGzipTarTextFiles } from "./githubTarball";

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, "0") + "\0";
}

function ustarFile(path: string, content: string): Buffer {
  const body = Buffer.from(content, "utf8");
  const header = Buffer.alloc(512, 0);
  const slash = path.lastIndexOf("/");
  const prefix = slash > 0 && path.length > 100 ? path.slice(0, slash) : "";
  const name = prefix ? path.slice(slash + 1) : path;
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "utf8");
  header.write(octal(body.length, 12), 124, 12, "utf8");
  header[156] = 0x30;
  header.write("ustar\0", 257, 6, "utf8");
  header.write("00", 263, 2, "utf8");
  if (prefix) header.write(prefix, 345, 155, "utf8");
  header.fill(0x20, 148, 156);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}

describe("GitHub template tarball", () => {
  it("strips the archive root and returns utf8 files", () => {
    const tar = Buffer.concat([
      ustarFile(
        "increase-roas-32-htl-website-template-astrobuild-sha/src/styles/theme.css",
        "--page-gutter: 24px;",
      ),
      Buffer.alloc(1024, 0),
    ]);
    expect(parseGzipTarTextFiles(gzipSync(tar))).toEqual([
      { path: "src/styles/theme.css", content: "--page-gutter: 24px;" },
    ]);
  });
});
