import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "http://127.0.0.1:3000";
const DEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "demo-resources", "sun-pool");
const saved = JSON.parse(await readFile(path.join(DEST, "launchpad-client.json"), "utf8"));
const CLIENT_ID = saved.clientId;

async function trpc(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const response = await fetch(`${API}/api/trpc/${procedure}?input=${encoded}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${procedure} failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.data.json;
}

async function headOk(url) {
  const response = await fetch(url.startsWith("http") ? url : `${API}${url}`);
  return { url, status: response.status, type: response.headers.get("content-type"), ok: response.ok };
}

const view = await trpc("astroConfig.get", { clientId: CLIENT_ID });
const input = view.input;
const assets = view.assets ?? [];
const slots = new Set(assets.map(asset => asset.slot));

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

check("business name", input.identity.businessName === "Sun Pool & Spa Supply", input.identity.businessName);
check("short name", input.identity.shortName === "Sun Pool", input.identity.shortName);
check("founded 1978", input.identity.foundedYear === 1978, String(input.identity.foundedYear));
check("site URL", input.identity.siteUrl.includes("sunpoolandspasupply.com"), input.identity.siteUrl);
check("phone", input.contact.phone === "+16195618587", input.contact.phone);
check("Lakeside address", input.address.city === "Lakeside" && input.address.postalCode === "92040");
check("coordinates", input.address.latitude.startsWith("32.857") && input.address.longitude.startsWith("-116.924"));
check("Sunday hours 10-14", input.hours.find(h => h.day === "sunday")?.opensAt === "10:00");
check("hot tubs enabled", input.categories["hot-tubs"].enabled);
check("swim spas enabled", input.categories["swim-spas"].enabled);
check("saunas off", !input.categories.saunas.enabled);
check("luxury theme, not aqua", input.brand.theme === "luxury" && input.brand.theme !== "aqua", input.brand.theme);
check("live-site fonts", input.brand.fonts.display === "Bricolage Grotesque" && input.brand.fonts.body === "Instrument Sans", `${input.brand.fonts.display} / ${input.brand.fonts.body}`);
check("info@ email", input.contact.email === "info@sunpoolandspasupply.com", input.contact.email);
check("service areas", input.serviceAreas.includes("East County San Diego"));
check("enabled homepage sections", input.homepageSections.filter(s => s.enabled).length >= 16, String(input.homepageSections.filter(s => s.enabled).length));
check("hero headline", input.homepageSections.some(s => s.fields.headline?.includes("San Diego County")));
check("hero uses live photo", Boolean(input.homepageSections.find(s => s.type === "hero")?.fields.backgroundImage));
check("reviews include Karen", input.homepageSections.some(s => s.fields.items?.includes("Karen")));

for (const slot of ["navLogo", "footerLogo", "inventoryLogo", "favicon", "ogImage", "categoryHotTubs", "categorySwimSpas"]) {
  check(`asset ${slot}`, slots.has(slot));
}
check("client marketing photos uploaded", Boolean(saved.uploaded?.hero && saved.uploaded?.showroom && saved.uploaded?.product));

const imageChecks = [];
for (const asset of assets.filter(a => ["navLogo", "hero", "categoryHotTubs", "ogImage", "favicon"].includes(a.slot))) {
  imageChecks.push(headOk(asset.storageUrl));
}
const imageResults = await Promise.all(imageChecks);
for (const result of imageResults) {
  check(`serve ${result.url.split("/").pop()}`, result.ok && (result.type ?? "").startsWith("image/"), `${result.status} ${result.type}`);
}

const pages = [
  "/",
  "/clients",
  `/workspace/${CLIENT_ID}`,
  `/workspace/${CLIENT_ID}/configuration?tab=basic`,
  `/workspace/${CLIENT_ID}/configuration?tab=media`,
  `/workspace/${CLIENT_ID}/configuration?tab=content`,
];
for (const page of pages) {
  const response = await fetch(`${API}${page}`);
  const html = await response.text();
  check(`page ${page}`, response.ok && html.includes("<div id=\"root\">"), String(response.status));
}

const failed = checks.filter(item => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
