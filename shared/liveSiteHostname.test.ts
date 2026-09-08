import { describe, expect, it } from "vitest";
import {
  describeHostnameAttachedToOtherWorker,
  explainPublishDomainError,
  isWorkersDevUrl,
  liveHostnameFromSiteUrl,
  liveUrlForHostname,
  parseHostnameAttachedToOtherWorker,
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

describe("custom domain ownership conflicts", () => {
  it("names the other Worker and tells the operator not to retry blindly", () => {
    const message = describeHostnameAttachedToOtherWorker(
      "increaseroasai.com",
      "website-old-demo-3",
    );
    expect(message).toContain('Worker "website-old-demo-3"');
    expect(message).toContain("until you confirm");
    expect(message).toContain("review Site URL");
  });

  it("rewrites a stored attach conflict for the Launch page", () => {
    expect(
      explainPublishDomainError(
        "increaseroasai.com is already attached to another Worker. Remove that custom domain first.",
      ),
    ).toContain("until you confirm");
  });

  it("parses the other Worker from a stored attach conflict", () => {
    expect(
      parseHostnameAttachedToOtherWorker(
        'increaseroasai.com is already attached to Worker "website-old-demo-3".',
      ),
    ).toEqual({
      hostname: "increaseroasai.com",
      otherWorkerName: "website-old-demo-3",
    });
    expect(parseHostnameAttachedToOtherWorker("Website build failed.")).toBeNull();
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
