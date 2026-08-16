import {
  isSupportedImageMimeType,
  type AssetKind,
  type SupportedImageMimeType,
} from "@shared/assetUpload";

type UploadTarget = {
  clientId: number;
  assetKind: AssetKind;
  slot: string;
};

type UploadSession = {
  uploadId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: Date;
};

type DirectUploadDependencies<Result> = {
  requestUpload(input: {
    clientId: number;
    assetKind: AssetKind;
    slot: string;
    originalFilename: string;
    mimeType: SupportedImageMimeType;
    sizeBytes: number;
  }): Promise<UploadSession>;
  completeUpload(input: { uploadId: string }): Promise<Result>;
  fetchFn: (input: string, init: RequestInit) => Promise<Response>;
};

export async function uploadAssetDirectly<Result>(
  file: File,
  target: UploadTarget,
  dependencies: DirectUploadDependencies<Result>,
): Promise<Result> {
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error("Choose a supported image file.");
  }
  const session = await dependencies.requestUpload({
    ...target,
    originalFilename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  let uploadResponse: Response;
  try {
    uploadResponse = await dependencies.fetchFn(session.uploadUrl, {
      method: "PUT",
      body: file,
      credentials: "omit",
      headers: session.requiredHeaders,
    });
  } catch {
    throw new Error("The image could not be uploaded. Try again.");
  }
  if (!uploadResponse.ok) {
    throw new Error("The image could not be uploaded. Try again.");
  }

  return dependencies.completeUpload({ uploadId: session.uploadId });
}
