import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const BASE = "http://127.0.0.1:3000";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "manual-assets");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(30000);

async function bodyText() {
  return page.locator("body").innerText();
}

async function waitForAny(needles, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await bodyText();
    if (needles.some(needle => text.includes(needle))) {
      await page.waitForTimeout(500);
      return text;
    }
    const retry = page.locator("text=Try again");
    if ((await retry.count()) > 0 && (await retry.first().isVisible().catch(() => false))) {
      await retry.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`Timed out waiting for: ${needles.join(" | ")}`);
}

async function boxFor(selector) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) return null;
  const box = await locator.first().boundingBox().catch(() => null);
  if (!box) return null;
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

async function collect(targets) {
  const marks = [];
  for (const target of targets) {
    const box = await boxFor(target.selector);
    if (box) marks.push({ id: target.id, label: target.label, box });
  }
  return marks;
}

async function shot(name, pathUrl, needles, targets) {
  await page.goto(`${BASE}${pathUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const text = await waitForAny(needles);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  const marks = await collect(targets);
  console.log(`SHOT ${name} marks=${marks.length}`);
  return { name, file, url: page.url(), marks, text: text.slice(0, 4000) };
}

const shots = [];

const clientsShot = await shot(
  "01-clients",
  "/clients",
  ["Total clients", "No clients yet", "Clients could not be loaded"],
  [
    { id: "logo", label: "Launchpad home", selector: '[aria-label="Launchpad home"]' },
    { id: "clients-nav", label: "Clients list", selector: 'a[href="/clients"]' },
    { id: "activity-nav", label: "Activity", selector: 'a[href="/activity"]' },
    { id: "new-client", label: "New client", selector: 'a[href="/clients/new"]' },
    { id: "stats", label: "Status cards", selector: "text=Total clients" },
    { id: "search", label: "Search box", selector: 'input[placeholder*="Search"]' },
    { id: "table", label: "Client list", selector: "table" },
  ],
);
shots.push(clientsShot);

let clientId = 0;
const href = await page.locator('a[href^="/workspace/"]').first().getAttribute("href").catch(() => null);
if (href) clientId = Number(href.match(/\/workspace\/(\d+)/)?.[1] ?? 0);
console.log("CLIENT_ID", clientId);

if (!clientId && clientsShot.text.includes("No clients yet")) {
  await page.goto(`${BASE}/clients/new`, { waitUntil: "domcontentloaded" });
  await waitForAny(["Create client"]);
  await page.locator('input[placeholder="Paradise Spas"]').fill("Sunny Splash Spas");
  await page.locator("text=Create client").click();
  await waitForAny(["Build progress", "Recommended next step", "Choose a client"]);
  const nextHref = page.url().match(/\/workspace\/(\d+)/);
  clientId = Number(nextHref?.[1] ?? 0);
}

if (!clientId) {
  await writeFile(path.join(outDir, "shots.json"), JSON.stringify({ clientId, shots }, null, 2));
  await browser.close();
  throw new Error("No client found to photograph.");
}

shots.push(
  await shot("02-new-client", "/clients/new", ["Create client"], [
    { id: "back", label: "Back to clients", selector: "text=Clients" },
    { id: "name", label: "Business name", selector: 'input[placeholder="Paradise Spas"]' },
    { id: "create", label: "Create client", selector: "text=Create client" },
  ]),
);

shots.push(
  await shot("03-overview", `/workspace/${clientId}`, ["Build progress", "Recommended next step", "Choose a client"], [
    { id: "tabs", label: "Client tabs", selector: 'nav[aria-label="Client sections"]' },
    { id: "preview", label: "Preview button", selector: 'button:has-text("Preview"), button:has-text("Open Preview"), button:has-text("Generate")' },
    { id: "actions", label: "Actions menu", selector: 'button:has-text("Actions")' },
    { id: "progress", label: "Build progress", selector: "text=Build progress" },
    { id: "path", label: "Build path steps", selector: "text=Client setup" },
  ]),
);

shots.push(
  await shot("04-basic", `/workspace/${clientId}/configuration?tab=basic`, ["Identity", "Website configuration could not"], [
    { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
    { id: "identity", label: "Business identity", selector: "text=Identity" },
    { id: "contact", label: "Phone and email", selector: "text=Contact" },
    { id: "name-field", label: "Business name field", selector: "text=Business name" },
    { id: "site-url", label: "Site URL", selector: "text=Site URL" },
  ]),
);

shots.push(
  await shot("05-branding", `/workspace/${clientId}/configuration?tab=branding`, ["Theme", "Website configuration could not"], [
    { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
    { id: "theme", label: "Theme cards", selector: "text=Theme" },
    { id: "aqua", label: "Aqua theme", selector: "text=Aqua" },
    { id: "fonts", label: "Fonts", selector: "text=Fonts" },
  ]),
);

shots.push(
  await shot("06-media", `/workspace/${clientId}/configuration?tab=media`, ["Brand images", "Website configuration could not"], [
    { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
    { id: "brand", label: "Brand images", selector: "text=Brand images" },
    { id: "nav-logo", label: "Navigation logo", selector: "text=Navigation logo" },
  ]),
);

shots.push(
  await shot("07-content", `/workspace/${clientId}/configuration?tab=content`, ["Homepage sections", "Website configuration could not"], [
    { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
    { id: "nav", label: "Website links", selector: "text=Navigation" },
    { id: "categories", label: "Product groups", selector: "text=Categories" },
    { id: "homepage", label: "Homepage sections", selector: "text=Homepage sections" },
  ]),
);

shots.push(
  await shot("08-technical", `/workspace/${clientId}/configuration?tab=technical`, ["Client integrations", "Website configuration could not"], [
    { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
    { id: "integrations", label: "Turn services on", selector: "text=Integrations" },
    { id: "ghl", label: "GoHighLevel", selector: "text=GoHighLevel" },
    { id: "open", label: "Open client integrations", selector: "text=Open client integrations" },
  ]),
);

shots.push(
  await shot("09-pages", `/workspace/${clientId}/pages`, ["Template pages", "Pages could not"], [
    { id: "tabs", label: "Client tabs", selector: 'nav[aria-label="Client sections"]' },
    { id: "stats", label: "Page counts", selector: "text=Template pages" },
    { id: "table", label: "Site map", selector: "table" },
    { id: "homepage", label: "Homepage row", selector: "text=Homepage" },
  ]),
);

shots.push(
  await shot("10-integrations", `/workspace/${clientId}/integrations`, ["GoHighLevel", "Integrations could not"], [
    { id: "back", label: "Back to configuration", selector: "text=Back to configuration" },
    { id: "ghl", label: "GoHighLevel secrets", selector: "text=GoHighLevel" },
    { id: "sheets", label: "Google Sheets", selector: "text=Google Sheets" },
  ]),
);

shots.push(
  await shot("11-launch", `/workspace/${clientId}/launch`, ["Readiness", "Choose a client"], [
    { id: "readiness", label: "Launch checks", selector: "text=Readiness" },
    { id: "next", label: "Next step", selector: "text=Recommended next step" },
    { id: "preview", label: "Preview website", selector: "text=Staging Worker" },
    { id: "production", label: "Live website", selector: "text=Live website" },
    { id: "publish", label: "Publish button", selector: 'button:has-text("Publish"), button:has-text("Connect live domain")' },
  ]),
);

shots.push(
  await shot("12-activity", "/activity", ["Current state by client", "No clients yet", "Activity"], [
    { id: "heading", label: "Activity heading", selector: "text=Activity" },
    { id: "list", label: "Client attention list", selector: "text=Current state by client" },
  ]),
);

await writeFile(
  path.join(outDir, "shots.json"),
  JSON.stringify({ clientId, capturedAt: new Date().toISOString(), shots }, null, 2),
);

await browser.close();
console.log("DONE", shots.length, "shots");
