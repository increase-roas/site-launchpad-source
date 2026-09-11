const API = "http://127.0.0.1:3000";
const CLIENT_ID = 8;

async function trpc(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const response = await fetch(`${API}/api/trpc/${procedure}?input=${encoded}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${procedure} failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.data.json;
}

function collectEmpty(value, path, out) {
  if (value == null) {
    out.push(path);
    return;
  }
  if (typeof value === "string") {
    if (value.trim() === "") out.push(path);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value === 0) out.push(path);
    return;
  }
  if (typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length === 0) out.push(path);
    value.forEach((item, index) => collectEmpty(item, `${path}[${index}]`, out));
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0 && !path.includes("integrations.ghl") && !path.includes("integrations.meta")) {
      out.push(path);
    }
    for (const key of keys) collectEmpty(value[key], path ? `${path}.${key}` : key, out);
  }
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

check("business name", input.identity.businessName === "The Hot Tub Store");
check("short name", input.identity.shortName === "Hot Tub Store");
check("founded 2014", input.identity.foundedYear === 2014, String(input.identity.foundedYear));
check("https site", input.identity.siteUrl.startsWith("https://"));
check("phone", input.contact.phone === "+14805550180");
check("email", input.contact.email.includes("@"));
check("Scottsdale", input.address.city === "Scottsdale");
check("coordinates", Boolean(input.address.latitude && input.address.longitude));
check("google place", Boolean(input.address.googlePlaceId));
check("all days open", input.hours.every(hour => hour.isOpen));
check("all socials", Object.values(input.socialLinks).every(Boolean));
check("financing on", input.financing.enabled);
check("all financing fields", [
  input.financing.lenderName,
  input.financing.lenderUrl,
  input.financing.disclaimer,
  input.financing.terms,
  input.financing.ctaLabel,
  input.financing.monthlyExample,
].every(Boolean));
check("all 5 categories on", Object.values(input.categories).every(category => category.enabled));
check("category copy", Object.values(input.categories).every(category => category.description && category.heroImage));
check("service areas", input.serviceAreas.includes("Scottsdale"));
check("all homepage sections on", input.homepageSections.every(section => section.enabled), `${input.homepageSections.filter(s => s.enabled).length}/${input.homepageSections.length}`);
check("section count", input.homepageSections.length >= 21, String(input.homepageSections.length));

const requiredSlots = [
  "navLogo", "footerLogo", "inventoryLogo", "favicon", "ogImage",
  "categoryHotTubs", "categorySwimSpas", "categorySaunas", "categoryColdPlunge", "categoryMassageChairs",
  "logo", "hero", "hotTubs", "swimSpas", "showroom", "product", "delivery",
];
for (const slot of requiredSlots) {
  check(`asset ${slot}`, slots.has(slot));
}

const imageResults = await Promise.all(
  assets.filter(asset => requiredSlots.includes(asset.slot)).map(async asset => {
    const url = asset.storageUrl.startsWith("http") ? asset.storageUrl : `${API}${asset.storageUrl}`;
    const response = await fetch(url);
    return { slot: asset.slot, ok: response.ok, type: response.headers.get("content-type") };
  }),
);
for (const result of imageResults) {
  check(`serve ${result.slot}`, result.ok && (result.type ?? "").startsWith("image/"), `${result.type}`);
}

const library = await trpc("assets.listLibrary", { clientId: CLIENT_ID });
const items = library.items ?? [];
check("library photos", items.length >= 6, String(items.length));
check("library alts", items.every(item => (item.alt ?? "").trim().length > 0));

const allowedEmpty = new Set([
  "navigationItems[0].href",
  "products.category",
  "homepageSections.find(s => s.type==='products').fields.category",
]);
const empty = [];
collectEmpty(input, "", empty);
const interesting = empty.filter(path => {
  if (path.includes("integrations.ghl.config") || path.includes("integrations.meta.config")) return false;
  if (path === "navigationItems[0].href") return false;
  if (path.endsWith("fields.category") && path.includes("products")) return false;
  return true;
});
check("no unexpected empty fields", interesting.length === 0, interesting.slice(0, 20).join("; "));

const pages = [
  "/",
  "/clients",
  `/workspace/${CLIENT_ID}`,
  `/workspace/${CLIENT_ID}/configuration?tab=basic`,
  `/workspace/${CLIENT_ID}/configuration?tab=branding`,
  `/workspace/${CLIENT_ID}/configuration?tab=media`,
  `/workspace/${CLIENT_ID}/configuration?tab=content`,
  `/workspace/${CLIENT_ID}/configuration?tab=technical`,
];
for (const page of pages) {
  const response = await fetch(`${API}${page}`);
  const html = await response.text();
  check(`page ${page}`, response.ok && html.includes("<div id=\"root\">"), String(response.status));
}

const failed = checks.filter(item => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (interesting.length) {
  console.log("Empty paths:");
  for (const path of interesting) console.log(`  - ${path}`);
}
if (failed.length) process.exit(1);
