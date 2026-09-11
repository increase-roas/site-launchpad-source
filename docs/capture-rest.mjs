import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const BASE = "http://127.0.0.1:3000";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "manual-assets");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30000);

async function bodyText() {
  return page.locator("body").innerText();
}

async function waitForAny(needles, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await bodyText();
    if (needles.some(needle => text.includes(needle))) {
      await page.waitForTimeout(600);
      return text;
    }
    const retry = page.locator("text=Try again");
    if ((await retry.count()) > 0 && (await retry.first().isVisible().catch(() => false))) {
      await retry.first().click().catch(() => {});
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
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
}

async function collect(targets) {
  const marks = [];
  for (const target of targets) {
    const box = await boxFor(target.selector);
    if (box) marks.push({ id: target.id, label: target.label, box });
  }
  return marks;
}

async function snap(name, targets) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  const marks = await collect(targets);
  const text = (await bodyText()).slice(0, 4000);
  console.log(`SHOT ${name} marks=${marks.length} url=${page.url()}`);
  return { name, file, url: page.url(), marks, text };
}

await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
await waitForAny(["Total clients"]);
const clientLink = page.locator('table a[href^="/workspace/"]').first();
await clientLink.waitFor({ state: "visible" });
await clientLink.click();
await waitForAny(["Build progress", "Recommended next step", "Build path"]);

const shots = [];
shots.push(await snap("03-overview", [
  { id: "tabs", label: "Client tabs", selector: 'nav[aria-label="Client sections"]' },
  { id: "preview", label: "Preview button", selector: 'button:has-text("Preview"), button:has-text("Open Preview"), button:has-text("Generate")' },
  { id: "actions", label: "Actions menu", selector: 'button:has-text("Actions")' },
  { id: "progress", label: "Build progress", selector: "text=Build progress" },
  { id: "next", label: "Next step card", selector: "text=Recommended next step" },
  { id: "path", label: "Build path steps", selector: "text=Client setup" },
]));

const clientId = Number(page.url().match(/\/workspace\/(\d+)/)?.[1] ?? 0);
console.log("CLIENT_ID", clientId);

async function go(name, url, needles, targets) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await waitForAny(needles);
  shots.push(await snap(name, targets));
}

await go("06-media", `/workspace/${clientId}/configuration?tab=media`, ["Photos", "Navigation logo", "Opening client"], [
  { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
  { id: "photos", label: "Photo list", selector: "text=Photos" },
  { id: "nav-logo", label: "Navigation logo", selector: "text=Navigation logo" },
]);

await go("07-content", `/workspace/${clientId}/configuration?tab=content`, ["Navigation", "Homepage sections", "Categories"], [
  { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
  { id: "nav", label: "Website links", selector: "text=Navigation" },
  { id: "categories", label: "Product groups", selector: "text=Categories" },
  { id: "homepage", label: "Homepage sections", selector: "text=Homepage sections" },
]);

await go("08-technical", `/workspace/${clientId}/configuration?tab=technical`, ["GoHighLevel", "Client integrations"], [
  { id: "strip", label: "Configuration steps", selector: 'nav[aria-label="Configuration sections"]' },
  { id: "integrations", label: "Turn services on", selector: "text=Integrations" },
  { id: "ghl", label: "GoHighLevel", selector: "text=GoHighLevel" },
  { id: "open", label: "Open client integrations", selector: "text=Open client integrations" },
]);

await go("09-pages", `/workspace/${clientId}/pages`, ["Template pages", "Homepage"], [
  { id: "tabs", label: "Client tabs", selector: 'nav[aria-label="Client sections"]' },
  { id: "stats", label: "Page counts", selector: "text=Template pages" },
  { id: "table", label: "Site map", selector: "table" },
  { id: "homepage", label: "Homepage row", selector: "text=Homepage" },
]);

await go("10-integrations", `/workspace/${clientId}/integrations`, ["GoHighLevel", "Google Sheets", "Website admin"], [
  { id: "back", label: "Back to configuration", selector: "text=Back to configuration" },
  { id: "ghl", label: "GoHighLevel secrets", selector: "text=GoHighLevel" },
  { id: "sheets", label: "Google Sheets", selector: "text=Google Sheets" },
]);

await go("11-launch", `/workspace/${clientId}/launch`, ["Readiness", "Recommended next step"], [
  { id: "readiness", label: "Launch checks", selector: "text=Readiness" },
  { id: "next", label: "Next step", selector: "text=Recommended next step" },
  { id: "preview", label: "Preview website", selector: "text=Staging Worker" },
  { id: "production", label: "Live website", selector: "text=Live website" },
  { id: "publish", label: "Publish button", selector: 'button:has-text("Publish"), button:has-text("Connect")' },
]);

await go("12-activity", "/activity", ["Current state by client", "Activity"], [
  { id: "heading", label: "Activity heading", selector: "text=Activity" },
  { id: "list", label: "Client attention list", selector: "text=Current state by client" },
]);

await writeFile(path.join(outDir, "shots-rest.json"), JSON.stringify({ clientId, shots }, null, 2));
await browser.close();
console.log("DONE", shots.length);
