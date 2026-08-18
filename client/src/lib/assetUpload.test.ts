import { describe, expect, it, vi } from "vitest";
import { uploadAssetDirectly } from "./assetUpload";

describe("browser direct asset upload", () => {
  it("performs request, raw R2 PUT, and completion in order without auth headers", async () => {
    const events: string[] = [];
    const file = new File(["raw-image"], "hero.png", { type: "image/png" });
    const requestUpload = vi.fn(async () => {
      events.push("request");
      return {
        uploadId: "123e4567-e89b-12d3-a456-426614174000",
        uploadUrl: "https://r2-upload.example.test/signed?X-Amz-Signature=test",
        requiredHeaders: { "Content-Type": "image/png" },
        expiresAt: new Date("2026-08-15T12:10:00.000Z"),
      };
    });
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      events.push("put");
      expect(init).toEqual({
        method: "PUT",
        body: file,
        credentials: "omit",
        headers: { "Content-Type": "image/png" },
      });
      expect(JSON.stringify(init.headers)).not.toContain("Authorization");
      return new Response(null, { status: 200 });
    });
    const completeUpload = vi.fn(async () => {
      events.push("complete");
      return { uploaded: true };
    });

    const result = await uploadAssetDirectly(
      file,
      { clientId: 7, assetKind: "client", slot: "hero" },
      { requestUpload, completeUpload, fetchFn },
    );

    expect(requestUpload).toHaveBeenCalledWith({
      clientId: 7,
      assetKind: "client",
      slot: "hero",
      originalFilename: "hero.png",
      mimeType: "image/png",
      sizeBytes: file.size,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://r2-upload.example.test/signed?X-Amz-Signature=test",
      expect.any(Object),
    );
    expect(completeUpload).toHaveBeenCalledWith({
      uploadId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(events).toEqual(["request", "put", "complete"]);
    expect(result).toEqual({ uploaded: true });
  });

  it("does not complete when the direct PUT fails", async () => {
    const completeUpload = vi.fn();

    await expect(
      uploadAssetDirectly(
        new File(["raw-image"], "hero.png", { type: "image/png" }),
        { clientId: 7, assetKind: "astro", slot: "navLogo" },
        {
          requestUpload: vi.fn(async () => ({
            uploadId: "123e4567-e89b-12d3-a456-426614174000",
            uploadUrl: "https://r2-upload.example.test/signed",
            requiredHeaders: { "Content-Type": "image/png" },
            expiresAt: new Date("2026-08-15T12:10:00.000Z"),
          })),
          fetchFn: vi.fn(async () => new Response(null, { status: 403 })),
          completeUpload,
        },
      ),
    ).rejects.toThrow("The image could not be uploaded. Try again.");
    expect(completeUpload).not.toHaveBeenCalled();
  });
});
