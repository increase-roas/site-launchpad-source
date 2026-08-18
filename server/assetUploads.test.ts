import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RAW_UPLOAD_BYTES,
  createAssetUploadService,
  type AssetUploadServiceDependencies,
  type AssetUploadSessionRecord,
} from "./assetUploads";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const UPLOAD_ID = "123e4567-e89b-12d3-a456-426614174000";
const VERSION_ID = "123e4567-e89b-12d3-a456-426614174999";
const TEMP_KEY = `tmp/7/${UPLOAD_ID}`;
const SOURCE = Buffer.from("source-image");
const PROCESSED = Buffer.from("processed-webp");

const pendingSession: AssetUploadSessionRecord = {
  id: UPLOAD_ID,
  clientId: 7,
  assetKind: "client",
  slot: "hero",
  originalFilename: "spa photo.png",
  declaredMimeType: "image/png",
  declaredSizeBytes: SOURCE.length,
  tempKey: TEMP_KEY,
  status: "pending",
  expiresAt: new Date(NOW.getTime() + 600_000),
  completedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function makeDependencies(
  overrides: Partial<AssetUploadServiceDependencies> = {},
): AssetUploadServiceDependencies {
  return {
    now: () => NOW,
    randomUUID: vi.fn()
      .mockReturnValueOnce(UPLOAD_ID)
      .mockReturnValue(VERSION_ID),
    publicAssetBaseUrl: "https://assets.example.com",
    getClientById: vi.fn(async () => ({ id: 7, shortName: "Paradise Spas" })),
    createUploadSession: vi.fn(async () => undefined),
    getUploadSession: vi.fn(async () => pendingSession),
    markUploadSessionFailed: vi.fn(async () => undefined),
    createPresignedPut: vi.fn(async () => "https://upload.example.test/signed"),
    headObject: vi.fn(async () => ({ contentLength: SOURCE.length })),
    getObjectBuffer: vi.fn(async () => SOURCE),
    inspectImageMimeType: vi.fn(async () => "image/png"),
    processClientImage: vi.fn(async () => ({
      buffer: PROCESSED,
      mimeType: "image/webp",
      byteSize: PROCESSED.length,
      width: 1200,
      height: 800,
    })),
    processAstroImage: vi.fn(async () => ({
      buffer: PROCESSED,
      mimeType: "image/webp",
      byteSize: PROCESSED.length,
      width: 1200,
      height: 800,
    })),
    putObject: vi.fn(async () => undefined),
    deleteObject: vi.fn(async () => undefined),
    finalizeUpload: vi.fn(async () => ({ previousStorageKey: "clients/7-old/hero-old.webp" })),
    ...overrides,
  };
}

describe("asset upload requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies the client before creating a server-keyed upload session", async () => {
    const deps = makeDependencies();
    const service = createAssetUploadService(deps);

    const result = await service.requestUpload({
      clientId: 7,
      assetKind: "client",
      slot: "hero",
      originalFilename: "photo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    });

    expect(deps.getClientById).toHaveBeenCalledWith(7);
    expect(deps.createUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: UPLOAD_ID,
        clientId: 7,
        assetKind: "client",
        slot: "hero",
        tempKey: TEMP_KEY,
        status: "pending",
      }),
    );
    expect(deps.createPresignedPut).toHaveBeenCalledWith({
      key: TEMP_KEY,
      contentType: "image/png",
      expiresInSeconds: 600,
    });
    expect(result).toEqual({
      uploadId: UPLOAD_ID,
      uploadUrl: "https://upload.example.test/signed",
      requiredHeaders: { "Content-Type": "image/png" },
      expiresAt: new Date(NOW.getTime() + 600_000),
    });
  });

  it("rejects a nonexistent client before persistence or presigning", async () => {
    const deps = makeDependencies({ getClientById: vi.fn(async () => undefined) });
    const service = createAssetUploadService(deps);

    await expect(
      service.requestUpload({
        clientId: 99,
        assetKind: "client",
        slot: "hero",
        originalFilename: "photo.png",
        mimeType: "image/png",
        sizeBytes: 1024,
      }),
    ).rejects.toThrow("Client not found.");
    expect(deps.createUploadSession).not.toHaveBeenCalled();
    expect(deps.createPresignedPut).not.toHaveBeenCalled();
  });

  it.each([
    { assetKind: "client" as const, slot: "categoryHotTubs" },
    { assetKind: "astro" as const, slot: "hero" },
  ])("prevents crossing client and Astro slot sets", async input => {
    const deps = makeDependencies();
    const service = createAssetUploadService(deps);

    await expect(
      service.requestUpload({
        clientId: 7,
        assetKind: input.assetKind,
        slot: input.slot,
        originalFilename: "photo.png",
        mimeType: "image/png",
        sizeBytes: 1024,
      }),
    ).rejects.toThrow("slot");
    expect(deps.createUploadSession).not.toHaveBeenCalled();
  });

  it.each([
    { mimeType: "image/svg+xml", sizeBytes: 1024 },
    { mimeType: "image/png", sizeBytes: 0 },
    { mimeType: "image/png", sizeBytes: MAX_RAW_UPLOAD_BYTES + 1 },
  ])("rejects unsupported MIME types and invalid sizes", async invalid => {
    const service = createAssetUploadService(makeDependencies());

    await expect(
      service.requestUpload({
        clientId: 7,
        assetKind: "client",
        slot: "hero",
        originalFilename: "photo.png",
        ...invalid,
      }),
    ).rejects.toThrow();
  });
});

describe("asset upload completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unknown, completed, failed, and expired sessions", async () => {
    const cases: Array<AssetUploadSessionRecord | undefined> = [
      undefined,
      { ...pendingSession, status: "completed" },
      { ...pendingSession, status: "failed" },
      { ...pendingSession, expiresAt: NOW },
    ];

    for (const session of cases) {
      const deps = makeDependencies({ getUploadSession: vi.fn(async () => session) });
      await expect(createAssetUploadService(deps).completeUpload(UPLOAD_ID)).rejects.toThrow();
      expect(deps.headObject).not.toHaveBeenCalled();
    }
  });

  it("rejects a session whose stored key crosses its client boundary", async () => {
    const deps = makeDependencies({
      getUploadSession: vi.fn(async () => ({ ...pendingSession, tempKey: `tmp/8/${UPLOAD_ID}` })),
    });

    await expect(createAssetUploadService(deps).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "Upload session is invalid.",
    );
    expect(deps.headObject).not.toHaveBeenCalled();
  });

  it("rejects missing temporary objects and size mismatches", async () => {
    const missing = makeDependencies({ headObject: vi.fn(async () => null) });
    await expect(createAssetUploadService(missing).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "uploaded file could not be found",
    );

    const mismatch = makeDependencies({
      headObject: vi.fn(async () => ({ contentLength: SOURCE.length + 1 })),
    });
    await expect(createAssetUploadService(mismatch).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "size does not match",
    );
    expect(mismatch.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("rejects MIME mismatches and corrupt images without changing the asset pointer", async () => {
    const mismatch = makeDependencies({
      inspectImageMimeType: vi.fn(async () => "image/jpeg"),
    });
    await expect(createAssetUploadService(mismatch).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "file type does not match",
    );
    expect(mismatch.finalizeUpload).not.toHaveBeenCalled();
    expect(mismatch.markUploadSessionFailed).toHaveBeenCalledWith(UPLOAD_ID);

    const corrupt = makeDependencies({
      inspectImageMimeType: vi.fn(async () => {
        throw new Error("sharp internals");
      }),
    });
    await expect(createAssetUploadService(corrupt).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "valid supported image",
    );
    expect(corrupt.finalizeUpload).not.toHaveBeenCalled();
  });

  it("keeps the database unchanged when processing or permanent upload fails", async () => {
    const processing = makeDependencies({
      processClientImage: vi.fn(async () => {
        throw new Error("sharp internals");
      }),
    });
    await expect(createAssetUploadService(processing).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "could not be processed",
    );
    expect(processing.putObject).not.toHaveBeenCalled();
    expect(processing.finalizeUpload).not.toHaveBeenCalled();

    const putFailure = makeDependencies({
      putObject: vi.fn(async () => {
        throw new Error("signed backend details");
      }),
    });
    await expect(createAssetUploadService(putFailure).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "could not be stored",
    );
    expect(putFailure.finalizeUpload).not.toHaveBeenCalled();
  });

  it("deletes a newly written permanent object when the database transaction fails", async () => {
    const deleted: string[] = [];
    const deps = makeDependencies({
      finalizeUpload: vi.fn(async () => {
        throw new Error("database internals");
      }),
      deleteObject: vi.fn(async key => {
        deleted.push(key);
      }),
    });

    await expect(createAssetUploadService(deps).completeUpload(UPLOAD_ID)).rejects.toThrow(
      "could not be finalized",
    );
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatch(/^clients\/7-paradise-spas\/assets\/hero-[a-f0-9]{64}-/);
    expect(deleted).not.toContain(TEMP_KEY);
  });

  it("swaps the pointer before deleting the temporary and previous objects", async () => {
    const events: string[] = [];
    const deps = makeDependencies({
      putObject: vi.fn(async () => {
        events.push("put-new");
      }),
      finalizeUpload: vi.fn(async () => {
        events.push("database-swap");
        return { previousStorageKey: "clients/7-old/assets/hero-old.webp" };
      }),
      deleteObject: vi.fn(async key => {
        events.push(`delete:${key}`);
      }),
    });

    const result = await createAssetUploadService(deps).completeUpload(UPLOAD_ID);
    const expectedHash = createHash("sha256").update(PROCESSED).digest("hex");

    expect(events[0]).toBe("put-new");
    expect(events[1]).toBe("database-swap");
    expect(events[2]).toBe(`delete:${TEMP_KEY}`);
    expect(events[3]).toBe("delete:clients/7-old/assets/hero-old.webp");
    expect(result.asset.storageKey).toContain(expectedHash);
    expect(result.asset.storageKey).toMatch(
      /^clients\/7-paradise-spas\/assets\/hero-[a-f0-9]{64}-[a-f0-9]{32}\.webp$/,
    );
    expect(result.asset.storageUrl).toBe(
      `https://assets.example.com/${result.asset.storageKey}`,
    );
    expect(deps.putObject).toHaveBeenCalledWith({
      key: result.asset.storageKey,
      body: PROCESSED,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
  });

  it("does not roll back success when old-object cleanup fails", async () => {
    const deps = makeDependencies({
      deleteObject: vi.fn(async key => {
        if (key.includes("old")) throw new Error("cleanup backend details");
      }),
    });

    await expect(createAssetUploadService(deps).completeUpload(UPLOAD_ID)).resolves.toMatchObject({
      clientId: 7,
      assetKind: "client",
      asset: { slot: "hero" },
    });
  });
});
