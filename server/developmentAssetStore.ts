import path from "node:path";
import {
  clientAssetStoragePrefix,
  createLocalAssetStore,
  DEFAULT_LOCAL_ASSET_URL_PREFIX,
  removeLocalAssetPrefix,
  type LocalAssetStore,
} from "./localAssetStore";

export { DEFAULT_LOCAL_ASSET_URL_PREFIX };

const DEFAULT_DIRECTORY = ".local-assets";

let store: LocalAssetStore | undefined;

/**
 * Shared by the upload service and the routes that serve the files back, so
 * both agree on the directory and the signing secret.
 */
export function getDevelopmentAssetStore(
  environment: NodeJS.ProcessEnv = process.env,
): LocalAssetStore {
  if (store) return store;
  const signingSecret = environment.JWT_SECRET?.trim();
  if (!signingSecret) {
    throw new Error("JWT_SECRET is required to sign local asset uploads.");
  }
  store = createLocalAssetStore({
    rootDirectory: path.resolve(
      process.cwd(),
      environment.LOCAL_ASSET_DIR?.trim() || DEFAULT_DIRECTORY,
    ),
    signingSecret,
  });
  return store;
}

/** Best-effort: leftover local files must not fail a completed delete. */
export async function removeDeletedClientLocalAssets(client: {
  id: number;
  shortName: string;
}): Promise<void> {
  if (process.env.ASSET_STORAGE_DRIVER !== "local") return;
  try {
    const store = getDevelopmentAssetStore();
    await removeLocalAssetPrefix(store.rootDirectory, clientAssetStoragePrefix(client));
  } catch {
    return;
  }
}
