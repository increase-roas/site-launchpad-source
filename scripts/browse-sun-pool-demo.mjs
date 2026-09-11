import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const BASE = "http://127.0.0.1:3000";
const DEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "demo-resources", "sun-pool");
const saved = JSON.parse(await readFile(path.join(DEST, "launchpad-client.json"), "utf8"));
const CLIENT = saved.clientId;
const outDir = path.join(DEST, "screens");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(45000);
page.on("pageerror", error => console.log("pageerror", error.message));
await mkdir(outDir, { recursive: true });

async function bodyText() {
  return page.locator("body").innerText();
}

async function waitForAny(needles, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await bodyText();
    if (needles.some(needle => text.includes(needle))) {
      await page.waitForTimeout(400);
      return text;
    }
    const retry = page.locator("text=Try again");
    if ((await retry.count()) > 0 && (await retry.first().isVisible().catch(() => false))) {
      await retry.first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(500);
  }
  return bodyText();
}

async function shot(name, pathUrl, needles) {
  await page.goto(`${BASE}${pathUrl}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  const text = await waitForAny(needles);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`SHOT ${name} url=${page.url()} chars=${text.length}`);
  return text;
}

const clients = await shot("01-clients", "/clients", ["Sun Pool"]);
if (!clients.includes("Sun Pool")) throw new Error("Clients page missing Sun Pool");

const overview = await shot("02-overview", `/workspace/${CLIENT}`, ["Sun Pool", "Lakeside"]);
if (!overview.includes("Sun Pool")) throw new Error("Overview missing Sun Pool");

const basic = await shot("03-basic", `/workspace/${CLIENT}/configuration?tab=basic`, ["Lakeside"]);
if (!basic.includes("Lakeside")) throw new Error("Basic info missing Lakeside");

const branding = await shot("04-branding", `/workspace/${CLIENT}/configuration?tab=branding`, ["Luxury", "Bricolage"]);
if (!/Luxury/i.test(branding)) throw new Error("Branding tab missing Luxury theme");
if (/Theme:\s*Aqua/i.test(branding)) throw new Error("Branding tab still on aqua preload");

const media = await shot("05-media", `/workspace/${CLIENT}/configuration?tab=media`, ["Navigation logo", "Hot tubs"]);
if (!/Hot tubs|Showroom|Navigation logo/i.test(media)) throw new Error("Media tab missing expected labels");

const content = await shot("06-content", `/workspace/${CLIENT}/configuration?tab=content`, ["San Diego"]);
if (!/San Diego|Reviews|Hot Tubs/i.test(content)) throw new Error("Content tab missing homepage copy");

await browser.close();
console.log("Browser walkthrough passed");
