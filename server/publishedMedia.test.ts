import { describe, expect, it, vi } from "vitest";
import { executePublishedMediaSync, readDraftAssetObject } from "./publishedMedia";

const draft = {
  mediaItemId: 11,
  storageKey: "clients/7-acme/astro/navLogo-aaa-111.webp",
  storageUrl: "/local-assets/clients/7-acme/astro/navLogo-aaa-111.webp",
};

const replaced = {
  mediaItemId: 8,
  draftStorageKey: "clients/7-acme/astro/old.webp",
  publishedKey: "clients/7-acme/astro/old.webp",
  publishedUrl: "https://pub.example/clients/7-acme/astro/old.webp",
  destinationBucket: "website-7-images",
};

describe("executePublishedMediaSync", () => {
  it("uploads only new drafts, skips unchanged files, and removes unused public objects", async () => {
    const putObject = vi.fn(async () => undefined);
    const deleteObject = vi.fn(async () => undefined);
    const savePublication = vi.fn(async input => ({
      mediaItemId: input.mediaItemId,
      draftStorageKey: input.draftStorageKey,
      publishedKey: input.publishedKey,
      publishedUrl: input.publishedUrl,
      destinationBucket: input.destinationBucket,
    }));
    const removePublication = vi.fn(async () => undefined);
    const readDraft = vi.fn(async () => ({
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
    }));

    const result = await executePublishedMediaSync({
      destinationBucket: "website-7-images",
      publicBaseUrl: "https://pub.example",
      used: [draft],
      publications: [replaced],
      readDraft,
      putObject,
      deleteObject,
      savePublication,
      removePublication,
    });

    expect(readDraft).toHaveBeenCalledWith(draft.storageKey);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledWith({
      key: draft.storageKey,
      body: Buffer.from("webp-bytes"),
      contentType: "image/webp",
    });
    expect(savePublication).toHaveBeenCalledWith({
      mediaItemId: 11,
      draftStorageKey: draft.storageKey,
      publishedKey: draft.storageKey,
      publishedUrl: "https://pub.example/clients/7-acme/astro/navLogo-aaa-111.webp",
      destinationBucket: "website-7-images",
    });
    expect(deleteObject).toHaveBeenCalledWith(replaced.publishedKey);
    expect(removePublication).toHaveBeenCalledWith(replaced);
    expect(result.urlByDraftKey).toEqual({
      [draft.storageKey]: "https://pub.example/clients/7-acme/astro/navLogo-aaa-111.webp",
    });
  });

  it("does not upload a draft that is already published to this bucket", async () => {
    const putObject = vi.fn(async () => undefined);
    const result = await executePublishedMediaSync({
      destinationBucket: "website-7-images",
      publicBaseUrl: "https://pub.example",
      used: [draft],
      publications: [{
        mediaItemId: 11,
        draftStorageKey: draft.storageKey,
        publishedKey: draft.storageKey,
        publishedUrl: "https://pub.example/clients/7-acme/astro/navLogo-aaa-111.webp",
        destinationBucket: "website-7-images",
      }],
      readDraft: vi.fn(),
      putObject,
      deleteObject: vi.fn(),
      savePublication: vi.fn(),
      removePublication: vi.fn(),
    });

    expect(putObject).not.toHaveBeenCalled();
    expect(result.urlByDraftKey[draft.storageKey]).toBe(
      "https://pub.example/clients/7-acme/astro/navLogo-aaa-111.webp",
    );
  });
});

describe("readDraftAssetObject", () => {
  it("reads production drafts from R2 instead of the local asset folder", async () => {
    const readLocal = vi.fn();
    const readRemote = vi.fn().mockResolvedValue({
      body: Buffer.from("r2-bytes"),
      contentType: "image/webp",
    });

    await expect(
      readDraftAssetObject("clients/7/astro/nav.webp", {
        driver: "r2",
        readLocal,
        readRemote,
      }),
    ).resolves.toEqual({
      body: Buffer.from("r2-bytes"),
      contentType: "image/webp",
    });
    expect(readLocal).not.toHaveBeenCalled();
  });
});
