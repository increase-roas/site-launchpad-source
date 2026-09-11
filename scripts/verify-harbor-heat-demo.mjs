const API = "http://127.0.0.1:3000";
const CLIENT_ID = 15;

async function trpc(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const response = await fetch(`${API}/api/trpc/${procedure}?input=${encoded}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${procedure} failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.data.json;
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

check("business name", input.identity.businessName === "Harbor & Heat Spas");
check("short name", input.identity.shortName === "Harbor Heat");
check("founded 2011", input.identity.foundedYear === 2011, String(input.identity.foundedYear));
check("https site", input.identity.siteUrl === "https://www.harborandheatspas.com");
check("phone", input.contact.phone === "+15035550190");
check("Lake Oswego", input.address.city === "Lake Oswego");
check("coordinates", Boolean(input.address.latitude && input.address.longitude));
check("all days open", input.hours.every(hour => hour.isOpen));
check("all socials", Object.values(input.socialLinks).every(Boolean));
check("financing on", input.financing.enabled);
check("all 5 categories on", Object.values(input.categories).every(category => category.enabled));
check("category heroes", Object.values(input.categories).every(category => category.heroImage));
check("all homepage sections on", input.homepageSections.every(section => section.enabled), `${input.homepageSections.filter(s => s.enabled).length}/${input.homepageSections.length}`);

const requiredSlots = [
  "navLogo", "footerLogo", "inventoryLogo", "favicon", "ogImage",
  "categoryHotTubs", "categorySwimSpas", "categorySaunas", "categoryColdPlunge", "categoryMassageChairs",
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

const workspace = await trpc("workspace.get", { clientId: CLIENT_ID });
const marketing = new Set((workspace.assets ?? []).map(asset => asset.slot));
for (const slot of ["logo", "hero", "hotTubs", "swimSpas", "showroom", "product", "delivery"]) {
  check(`marketing ${slot}`, marketing.has(slot));
}

const failed = checks.filter(item => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
