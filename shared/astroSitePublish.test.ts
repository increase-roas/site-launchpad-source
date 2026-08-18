import { describe, expect, it } from "vitest";
import {
  astroSitePublishProgress,
  astroSitePublishResourceNames,
} from "./astroSitePublish";

describe("Astro site publish resource names", () => {
  it("creates deterministic bounded names for one client", () => {
    expect(astroSitePublishResourceNames("North Star Spas", 42)).toEqual({
      externalSiteId: "astro-site-client-42",
      resourceName: "website-north-star-spas-42",
      repositoryName: "website-north-star-spas-42",
      workerName: "website-north-star-spas-42",
      d1DatabaseName: "website-north-star-spas-42-inventory",
      r2BucketName: "website-north-star-spas-42-images",
    });
  });

  it("bounds every Cloudflare resource name", () => {
    const names = astroSitePublishResourceNames("A".repeat(200), 9,);
    expect(names.resourceName.length).toBeLessThanOrEqual(63);
    expect(names.d1DatabaseName.length).toBeLessThanOrEqual(63);
    expect(names.r2BucketName.length).toBeLessThanOrEqual(63);
  });

  it("reports progress without counting the terminal marker", () => {
    expect(astroSitePublishProgress("create_repository")).toEqual({
      completed: 0,
      total: 8,
    });
    expect(astroSitePublishProgress("published")).toEqual({
      completed: 8,
      total: 8,
    });
  });
});
