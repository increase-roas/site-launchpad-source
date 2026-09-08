import { astroSitePreviewStore } from "../server/preview/astroSitePreviewDb";
import { syncClientPublishedMedia } from "../server/publishedMedia";
import { createCloudflareApiClient } from "../server/publisher/cloudflareApi";
import { getCloudflarePublisherEnvironment } from "../server/publisher/publisherEnv";

const clientId = Number(process.env.SYNC_CLIENT_ID ?? "");
if (!Number.isInteger(clientId) || clientId <= 0) {
  throw new Error("Set SYNC_CLIENT_ID to the client whose drafts should be copied to the website bucket.");
}

const job = await astroSitePreviewStore.getLatest(clientId);
if (!job) {
  throw new Error(`No preview job found for client ${clientId}. Generate preview once so the website bucket exists.`);
}

const cloudflare = createCloudflareApiClient(getCloudflarePublisherEnvironment());
const bucket = await cloudflare.ensureR2Bucket(job.r2BucketName, new AbortController().signal);
const publicBaseUrl = job.r2PublicUrl?.trim() || bucket.publicUrl;

await syncClientPublishedMedia({
  clientId,
  destinationBucket: job.r2BucketName,
  publicBaseUrl,
});

console.log(`Copied used drafts for client ${clientId} to ${job.r2BucketName}.`);
process.exit(0);
