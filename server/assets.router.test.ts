import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { createAssetsRouter } from "./routers/assets";

function context(authenticated = true): TrpcContext {
  return {
    user: authenticated
      ? {
          id: 1,
          authUserId: "123e4567-e89b-12d3-a456-426614174003",
          name: "Asset Test",
          email: "asset@example.com",
          loginMethod: "google",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("assets router boundary", () => {
  const operations = {
    requestUpload: vi.fn(async () => ({
      uploadId: "123e4567-e89b-12d3-a456-426614174000",
      uploadUrl: "https://upload.example.test/signed",
      requiredHeaders: { "Content-Type": "image/png" },
      expiresAt: new Date("2026-08-15T12:10:00.000Z"),
    })),
    completeUpload: vi.fn(async () => ({
      clientId: 7,
      assetKind: "client" as const,
      asset: {
        clientId: 7,
        slot: "hero",
        storageKey: "clients/7-test/assets/hero-hash.webp",
        storageUrl: "https://assets.example.com/clients/7-test/assets/hero-hash.webp",
        filename: "hero.webp",
        originalFilename: "hero.png",
        mimeType: "image/webp",
        byteSize: 100,
        width: 1200,
        height: 800,
      },
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated upload requests before service work", async () => {
    const caller = createAssetsRouter(operations).createCaller(context(false));

    await expect(
      caller.requestUpload({
        clientId: 7,
        assetKind: "client",
        slot: "hero",
        originalFilename: "hero.png",
        mimeType: "image/png",
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    expect(operations.requestUpload).not.toHaveBeenCalled();
  });

  it("rejects browser-supplied object keys instead of forwarding them", async () => {
    const caller = createAssetsRouter(operations).createCaller(context());

    await expect(
      caller.requestUpload({
        clientId: 7,
        assetKind: "client",
        slot: "hero",
        originalFilename: "hero.png",
        mimeType: "image/png",
        sizeBytes: 100,
        objectKey: "clients/other/controlled.webp",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(operations.requestUpload).not.toHaveBeenCalled();
  });

  it("completes uploads using only the opaque upload ID", async () => {
    const caller = createAssetsRouter(operations).createCaller(context());

    await caller.completeUpload({
      uploadId: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(operations.completeUpload).toHaveBeenCalledWith(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });
});
