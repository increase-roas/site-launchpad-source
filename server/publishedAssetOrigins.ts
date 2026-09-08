import { astroSitePreviewStore } from "./preview/astroSitePreviewDb";
import { astroSitePublishStore } from "./publisher/astroSitePublishDb";

/** Public website-bucket origins already used by this client's preview or publish. */
export async function findPublishedAssetBaseUrls(
  clientId: number,
): Promise<string[]> {
  const [preview, publish] = await Promise.all([
    astroSitePreviewStore.getLatest(clientId).catch(() => null),
    astroSitePublishStore.get(clientId).catch(() => null),
  ]);
  const urls: string[] = [];
  for (const url of [preview?.r2PublicUrl, publish?.r2PublicUrl]) {
    const origin = url?.trim();
    if (origin && !urls.includes(origin)) urls.push(origin);
  }
  return urls;
}
