import { describe, expect, it, vi } from "vitest";
import {
  createPublisherDraftObjectStore,
  readPublisherDraftObject,
  writePublisherDraftObject,
} from "./publisherDraftStore";

function cloudflareMock() {
  return {
    ensureR2Bucket: vi.fn().mockResolvedValue({
      id: "bucket-1",
      name: "site-launchpad-drafts",
      publicUrl: "https://pub.example",
      created: true,
    }),
    putR2Object: vi.fn().mockResolvedValue(undefined),
    getR2Object: vi.fn().mockResolvedValue({
      body: Buffer.from("draft-bytes"),
      contentType: "image/webp",
    }),
  };
}

describe("publisher draft store", () => {
  it("writes permanent keys into the shared draft bucket", async () => {
    const cloudflare = cloudflareMock();
    await writePublisherDraftObject(
      {
        key: "clients/15/astro/nav.webp",
        body: Buffer.from("nav"),
        contentType: "image/webp",
      },
      { cloudflare: cloudflare as never, bucket: "site-launchpad-drafts" },
    );
    expect(cloudflare.ensureR2Bucket).toHaveBeenCalledWith(
      "site-launchpad-drafts",
      expect.any(AbortSignal),
    );
    expect(cloudflare.putR2Object).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "site-launchpad-drafts",
        key: "clients/15/astro/nav.webp",
      }),
    );
  });

  it("does not copy staging uploads into the shared draft bucket", async () => {
    const cloudflare = cloudflareMock();
    const store = createPublisherDraftObjectStore({
      cloudflare: cloudflare as never,
    });
    await store.putObject({
      key: "tmp/15/upload",
      body: Buffer.from("temp"),
      contentType: "image/webp",
      cacheControl: "no-store",
    });
    expect(cloudflare.putR2Object).not.toHaveBeenCalled();
  });

  it("reads a shared draft after Launchpad S3 misses", async () => {
    const cloudflare = cloudflareMock();
    await expect(
      readPublisherDraftObject("clients/15/astro/nav.webp", {
        cloudflare: cloudflare as never,
      }),
    ).resolves.toEqual({
      body: Buffer.from("draft-bytes"),
      contentType: "image/webp",
    });
  });
});
