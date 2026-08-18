import { describe, expect, it } from "vitest";
import { GENERIC_PAID_FUNNEL_PACKAGE } from "./paidFunnelFixture";
import {
  PAID_FUNNEL_ZIP_MAX_FILES,
  createStoreZip,
  ingestPaidFunnelZip,
  inspectPaidFunnelZip,
} from "./paidFunnelZip";

function zipWith(
  files: Array<{ path: string; contents: string | Buffer }>
): Buffer {
  return createStoreZip(
    files.map(file => ({
      path: file.path,
      data: Buffer.isBuffer(file.contents)
        ? file.contents
        : Buffer.from(file.contents),
    }))
  );
}

describe("paid funnel zip intake", () => {
  it("accepts an explicit launchpad.template.json package", () => {
    const zip = zipWith([
      {
        path: "launchpad.template.json",
        contents: JSON.stringify(GENERIC_PAID_FUNNEL_PACKAGE),
      },
    ]);
    const result = ingestPaidFunnelZip(zip);
    expect(result.status).toBe("ready");
    expect(result.pkg?.templateKey).toBe("generic-paid-funnel");
    expect(result.unsupportedRegions).toEqual([]);
  });

  it("rejects path traversal", () => {
    expect(() =>
      inspectPaidFunnelZip(
        zipWith([{ path: "../secrets/id_rsa", contents: "nope" }])
      )
    ).toThrow(/traversal/i);
  });

  it("rejects credential files", () => {
    expect(() =>
      inspectPaidFunnelZip(
        zipWith([{ path: ".env", contents: "META_CAPI_ACCESS_TOKEN=secret" }])
      )
    ).toThrow(/Credential file rejected/);
  });

  it("rejects executables", () => {
    expect(() =>
      inspectPaidFunnelZip(
        zipWith([
          {
            path: "bin/run.sh",
            contents: "#!/bin/sh\necho hi\n",
          },
        ])
      )
    ).toThrow(/Executable file rejected/);
  });

  it("rejects archives with more than 2000 files", () => {
    const files = Array.from(
      { length: PAID_FUNNEL_ZIP_MAX_FILES + 1 },
      (_, i) => ({
        path: `file-${i}.txt`,
        contents: "x",
      })
    );
    expect(() => inspectPaidFunnelZip(zipWith(files))).toThrow(/2000 files/);
  });

  it("auto-detects HTML and returns exact unsupported-region errors", () => {
    const zip = zipWith([
      {
        path: "index.html",
        contents:
          "<html><body><h1>Hi</h1><script>alert(1)</script><iframe src='https://example.com'></iframe></body></html>",
      },
    ]);
    const result = ingestPaidFunnelZip(zip);
    expect(result.status).toBe("draft");
    expect(result.pkg?.framework).toBe("static-html");
    expect(result.unsupportedRegions).toEqual(
      expect.arrayContaining([
        {
          path: "index.html",
          reason: "Inline or linked script is not a visual graph element.",
        },
        {
          path: "index.html",
          reason: "iframe is an unsupported region.",
        },
      ])
    );
  });

  it("auto-detects Astro sources as draft intake", () => {
    const zip = zipWith([
      {
        path: "astro.config.mjs",
        contents: "export default {};",
      },
      {
        path: "src/pages/index.astro",
        contents: "<h1>Hello</h1>",
      },
    ]);
    const result = ingestPaidFunnelZip(zip);
    expect(result.status).toBe("draft");
    expect(result.pkg?.framework).toBe("astro");
    expect(result.unsupportedRegions[0]?.reason).toMatch(/visual graph/i);
  });
});
