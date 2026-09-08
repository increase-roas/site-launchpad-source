import { describe, expect, it } from "vitest";
import { serializeGalleryImages } from "./mediaLibrary";
import {
  applyPublishedAssetUrls,
  applyPublishedHomepageUrls,
  applyPublishedLibraryUrls,
  clientIdFromDraftStorageKey,
  collectUsedDraftMedia,
  describeMissingDraftImage,
  explainPreviewMediaError,
  isDraftLocalAssetUrl,
  isPublicDeployAssetUrl,
  planMediaSync,
  publicObjectUrl,
  type MediaPublication,
  type UsedDraftMedia,
} from "./publishedMedia";

const localNav: UsedDraftMedia = {
  mediaItemId: 11,
  storageKey: "clients/7-acme/astro/navLogo-aaa-111.webp",
  storageUrl: "/local-assets/clients/7-acme/astro/navLogo-aaa-111.webp",
};

const localHero: UsedDraftMedia = {
  mediaItemId: 12,
  storageKey: "clients/7-acme/astro/categoryHotTubs-bbb-222.webp",
  storageUrl: "/local-assets/clients/7-acme/astro/categoryHotTubs-bbb-222.webp",
};

const alreadyPublic: UsedDraftMedia = {
  mediaItemId: 13,
  storageKey: "clients/7-acme/astro/ogImage-ccc-333.webp",
  storageUrl: "https://assets.example.com/clients/7-acme/astro/ogImage-ccc-333.webp",
};

describe("draft vs public media URLs", () => {
  it("reads the client id from a draft storage key", () => {
    expect(clientIdFromDraftStorageKey("clients/8-the-hot-tub-store/astro/nav.webp")).toBe(8);
    expect(clientIdFromDraftStorageKey("clients/7/library/showroom.webp")).toBe(7);
    expect(clientIdFromDraftStorageKey("tmp/8/upload.webp")).toBeNull();
  });

  it("treats Launchpad local paths as drafts, not public Worker URLs", () => {
    expect(isDraftLocalAssetUrl("/local-assets/clients/7/nav.webp")).toBe(true);
    expect(isPublicDeployAssetUrl("/local-assets/clients/7/nav.webp")).toBe(false);
    expect(isPublicDeployAssetUrl("https://pub.example/nav.webp")).toBe(true);
    expect(isPublicDeployAssetUrl("/brand/logo-nav.svg")).toBe(true);
    expect(isDraftLocalAssetUrl("http://127.0.0.1:3000/local-assets/clients/7/nav.webp")).toBe(true);
    expect(isPublicDeployAssetUrl("http://127.0.0.1:3000/local-assets/clients/7/nav.webp")).toBe(false);
    expect(isPublicDeployAssetUrl("http://localhost:3000/local-assets/clients/7/nav.webp")).toBe(false);
    expect(isPublicDeployAssetUrl("http://evil.example/nav.webp")).toBe(false);
  });

  it("explains a missing draft as a local-vs-Vercel storage gap", () => {
    expect(describeMissingDraftImage(localNav.storageKey)).toContain(
      "not in this environment's storage",
    );
    expect(explainPreviewMediaError(`Draft image is missing: ${localNav.storageKey}`)).toContain(
      "Re-upload \"navLogo-aaa-111.webp\"",
    );
  });

  it("builds a public object URL from the website bucket origin", () => {
    expect(publicObjectUrl("https://pub.example", "clients/7/nav.webp")).toBe(
      "https://pub.example/clients/7/nav.webp",
    );
  });
});

describe("collectUsedDraftMedia", () => {
  it("keeps placed slots and gallery photos, and skips unused library files", () => {
    const used = collectUsedDraftMedia({
      assets: [
        { slot: "navLogo", storageKey: localNav.storageKey, storageUrl: localNav.storageUrl, mediaItemId: 11 },
      ],
      mediaItems: [
        { id: 11, storageKey: localNav.storageKey, storageUrl: localNav.storageUrl },
        { id: 12, storageKey: localHero.storageKey, storageUrl: localHero.storageUrl },
        { id: 99, storageKey: "clients/7-acme/library/unused.webp", storageUrl: "/local-assets/unused.webp" },
      ],
      homepageSections: [
        {
          enabled: true,
          type: "gallery",
          fields: {
            heading: "Showroom",
            images: serializeGalleryImages([
              { id: 12, src: localHero.storageUrl, alt: "Floor", description: "" },
            ]),
          },
        },
      ],
    });

    expect(used).toEqual([localNav, localHero]);
  });

  it("collects hero backgrounds and card images from homepage fields", () => {
    const used = collectUsedDraftMedia({
      assets: [],
      mediaItems: [
        { id: 12, storageKey: localHero.storageKey, storageUrl: localHero.storageUrl },
      ],
      homepageSections: [
        {
          enabled: true,
          type: "hero",
          fields: {
            backgroundImage: localHero.storageUrl,
          },
        },
        {
          enabled: true,
          type: "cards",
          fields: {
            items: `Hot Tubs | Deep seats | /hot-tubs | ${localNav.storageUrl}`,
          },
        },
      ],
    });

    expect(used.map(item => item.storageKey).sort()).toEqual(
      [localHero.storageKey, localNav.storageKey].sort(),
    );
  });
});

describe("planMediaSync", () => {
  it("uploads new drafts, reuses an unchanged publish, keeps public HTTPS, and deletes unused objects", () => {
    const existing: MediaPublication = {
      mediaItemId: 11,
      draftStorageKey: localNav.storageKey,
      publishedKey: localNav.storageKey,
      publishedUrl: "https://pub.example/clients/7-acme/astro/navLogo-aaa-111.webp",
      destinationBucket: "website-7-images",
    };
    const leftover: MediaPublication = {
      mediaItemId: 8,
      draftStorageKey: "clients/7-acme/astro/old.webp",
      publishedKey: "clients/7-acme/astro/old.webp",
      publishedUrl: "https://pub.example/clients/7-acme/astro/old.webp",
      destinationBucket: "website-7-images",
    };

    const plan = planMediaSync({
      used: [localNav, localHero, alreadyPublic],
      publications: [existing, leftover],
      destinationBucket: "website-7-images",
    });

    expect(plan.upload.map(item => item.storageKey)).toEqual([localHero.storageKey]);
    expect(plan.reuse.map(item => item.media.storageKey)).toEqual([localNav.storageKey]);
    expect(plan.keepPublic.map(item => item.storageKey)).toEqual([alreadyPublic.storageKey]);
    expect(plan.delete).toEqual([leftover]);
  });

  it("does not reuse a publication from a different website bucket", () => {
    const plan = planMediaSync({
      used: [localNav],
      publications: [{
        mediaItemId: 11,
        draftStorageKey: localNav.storageKey,
        publishedKey: localNav.storageKey,
        publishedUrl: "https://other.example/nav.webp",
        destinationBucket: "other-bucket",
      }],
      destinationBucket: "website-7-images",
    });

    expect(plan.upload).toEqual([localNav]);
    expect(plan.reuse).toEqual([]);
  });
});

describe("apply published URLs", () => {
  it("rewrites slot and library URLs from the draft key map", () => {
    const urlByDraftKey = {
      [localNav.storageKey]: "https://pub.example/nav.webp",
    };
    expect(applyPublishedAssetUrls(
      [{ slot: "navLogo", storageKey: localNav.storageKey, storageUrl: localNav.storageUrl }],
      urlByDraftKey,
    )).toEqual({ navLogo: "https://pub.example/nav.webp" });
    expect(applyPublishedLibraryUrls(
      [{ id: 11, storageKey: localNav.storageKey, storageUrl: localNav.storageUrl, alt: "Logo", description: "" }],
      urlByDraftKey,
    )).toEqual([
      { id: 11, storageUrl: "https://pub.example/nav.webp", alt: "Logo", description: "" },
    ]);
  });

  it("rewrites draft paths inside homepage fields", () => {
    const rewritten = applyPublishedHomepageUrls(
      [{
        enabled: true,
        type: "hero",
        fields: { backgroundImage: localNav.storageUrl },
      }],
      { [localNav.storageKey]: "https://pub.example/nav.webp" },
    );
    expect(rewritten[0]?.fields.backgroundImage).toBe("https://pub.example/nav.webp");
  });
});
