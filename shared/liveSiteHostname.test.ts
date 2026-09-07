import { describe, expect, it } from "vitest";
import {
  isWorkersDevUrl,
  liveHostnameFromSiteUrl,
  liveUrlForHostname,
  zoneNameCandidates,
} from "./liveSiteHostname";

describe("liveHostnameFromSiteUrl", () => {
  it("reads the host from the Site URL", () => {
    expect(liveHostnameFromSiteUrl("https://www.theclient.com/about")).toBe(
      "www.theclient.com",
    );
  });

  it("rejects preview and workers.dev addresses", () => {
    expect(() =>
      liveHostnameFromSiteUrl(
        "https://website-north-star-5.increase-roas.workers.dev",
      ),
    ).toThrow("real domain");
  });

  it("rejects http and invalid hosts", () => {
    expect(() => liveHostnameFromSiteUrl("http://theclient.com")).toThrow(
      "https://",
    );
    expect(() => liveHostnameFromSiteUrl("https://localhost")).toThrow(
      "real domain",
    );
  });
});

describe("zoneNameCandidates", () => {
  it("tries the hostname and then each parent zone", () => {
    expect(zoneNameCandidates("www.theclient.com")).toEqual([
      "www.theclient.com",
      "theclient.com",
    ]);
  });
});

describe("workers.dev detection", () => {
  it("treats only workers.dev hosts as temporary live URLs", () => {
    expect(
      isWorkersDevUrl("https://website-north-star-5.increase-roas.workers.dev"),
    ).toBe(true);
    expect(isWorkersDevUrl("https://www.theclient.com")).toBe(false);
    expect(liveUrlForHostname("www.theclient.com")).toBe(
      "https://www.theclient.com",
    );
  });
});
