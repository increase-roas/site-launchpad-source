import { describe, expect, it } from "vitest";
import {
  astroSitePublishContractConflicts,
  astroSitePublishProgress,
  astroSitePublishResourceNames,
  astroSitePublishStartPatch,
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
      total: 9,
    });
    expect(astroSitePublishProgress("published")).toEqual({
      completed: 9,
      total: 9,
    });
  });
});

describe("Astro site publish start", () => {
  const job = {
    status: "published" as const,
    step: "published" as const,
    liveUrl: "https://www.thehottubstore.com",
    templateRepo: "increase-roas/32-htl-website-template-astrobuild",
  };

  it("reopens a live custom-domain site so Publish again can move phases", () => {
    expect(
      astroSitePublishStartPatch(job, {
        templateRepo: job.templateRepo,
      }),
    ).toMatchObject({
      step: "create_repository",
      status: "pending",
      commitSha: null,
      dispatchRequestedAt: null,
    });
  });

  it("still only reconnects a workers.dev site to its live domain", () => {
    expect(
      astroSitePublishStartPatch(
        { ...job, liveUrl: "https://website-hot-tub-store-5.increase-roas.workers.dev" },
        { templateRepo: job.templateRepo },
      ),
    ).toMatchObject({
      step: "attach_custom_domain",
      status: "pending",
    });
  });

  it("leaves an in-flight publish alone", () => {
    expect(
      astroSitePublishStartPatch(
        { ...job, status: "pending", step: "commit_source", liveUrl: null },
        { templateRepo: job.templateRepo },
      ),
    ).toBeNull();
  });
});

describe("Astro site publish contract", () => {
  const current = {
    templateKey: "htl-astro-website",
    templateRepo: "increase-roas/32-htl-website-template-astrobuild",
    contractVersion: 1,
  };

  it("treats a renamed GitHub owner as the same template", () => {
    expect(
      astroSitePublishContractConflicts(
        {
          ...current,
          templateRepo: "increaseroasir/32-htl-website-template-astrobuild",
        },
        current,
      ),
    ).toBe(false);
  });

  it("still rejects a different template product", () => {
    expect(
      astroSitePublishContractConflicts(
        { ...current, templateKey: "other-website" },
        current,
      ),
    ).toBe(true);
    expect(
      astroSitePublishContractConflicts(
        { ...current, templateRepo: "increase-roas/other-website-template" },
        current,
      ),
    ).toBe(true);
    expect(
      astroSitePublishContractConflicts(
        { ...current, contractVersion: 2 },
        current,
      ),
    ).toBe(true);
  });
});
