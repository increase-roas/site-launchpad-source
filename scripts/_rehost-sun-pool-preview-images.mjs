/**
 * Copy scraped Sun Pool product photos onto the preview R2 bucket and
 * rewrite preview D1 URLs off the live pub-*.r2.dev host (that host 401s).
 */
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.resolve(
  ROOT,
  "..",
  "32-htl-website-template-astrobuild",
  "scraped-images-sun-pool",
  "pub-24055549503540b0b5ff19237b87d146.r2.dev",
  "products",
);
const OLD_HOST = "https://pub-24055549503540b0b5ff19237b87d146.r2.dev";
const BUCKET = "website-sun-pool-17-images";
const DATABASE_ID = "c1db2f6a-a617-4aa4-afc3-25b08482767d";

function readDotEnv() {
  const text = readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

readDotEnv();

const accountId = process.env.PUBLISHER_CLOUDFLARE_ACCOUNT_ID?.trim();
const token = process.env.PUBLISHER_CLOUDFLARE_API_TOKEN?.trim();
if (!accountId || !token) {
  throw new Error("PUBLISHER_CLOUDFLARE_ACCOUNT_ID and PUBLISHER_CLOUDFLARE_API_TOKEN are required.");
}

const api = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

async function cf(pathName, init = {}) {
  const response = await fetch(`${api}${pathName}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathName} → HTTP ${response.status}`);
  }
  return body;
}

const managed = await cf(`/r2/buckets/${encodeURIComponent(BUCKET)}/domains/managed`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true }),
});
const domain = managed.result?.domain;
if (!domain) throw new Error("R2 managed public domain was not returned.");
const publicBase = `https://${domain}`;
console.log(`public ${publicBase}`);

const files = (await readdir(SRC_DIR)).filter(name => /\.(webp|jpe?g|png)$/i.test(name));
for (const name of files) {
  const key = `products/${name}`;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  const bytes = await readFile(path.join(SRC_DIR, name));
  const contentType = name.endsWith(".png")
    ? "image/png"
    : name.endsWith(".jpg") || name.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/webp";
  await cf(`/r2/buckets/${encodeURIComponent(BUCKET)}/objects/${encoded}`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
  });
  console.log(`uploaded ${key}`);
}

const updated = await cf(`/d1/database/${DATABASE_ID}/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sql: `UPDATE products
          SET primary_image = REPLACE(primary_image, ?, ?),
              gallery_images = REPLACE(gallery_images, ?, ?),
              updated_at = ?`,
    params: [OLD_HOST, publicBase, OLD_HOST, publicBase, Date.now()],
  }),
});
const changes = updated.result?.[0]?.meta?.changes ?? updated.result?.[0]?.changes ?? "?";
console.log(`rewrote ${changes} product rows`);
console.log("done");
