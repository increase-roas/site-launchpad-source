import path from "node:path";
import {
  createLocalAssetStore,
  DEFAULT_LOCAL_ASSET_URL_PREFIX,
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
