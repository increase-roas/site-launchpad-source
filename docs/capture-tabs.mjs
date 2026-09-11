import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const BASE = "http://127.0.0.1:3000";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "manual-assets");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function waitUntil(ok, timeoutMs = 50000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.locator("body").innerText();
    if (ok(text)) {
      await page.waitForTimeout(800);
      return text;
    }
    await page.waitForTimeout(400);
  }
  return page.locator("body").innerText();
}

async function snap(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
  console.log("SHOT", name);
}

await page.goto(`${BASE}/workspace/15/configuration?tab=basic`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Identity") && text.includes("Business name"));
console.log("basic loaded");

await page.locator('nav[aria-label="Configuration sections"] button:has-text("Media")').click();
await waitUntil(text => text.includes("Photos") || text.includes("Navigation logo") || text.includes("Brand images"));
await snap("06-media");

await page.locator('a[href$="/launch"]').first().click();
await waitUntil(text => text.includes("Readiness") || text.includes("Recommended next step") || text.includes("Preview"));
await snap("11-launch");

await page.goto(`${BASE}/activity`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Current state by client") || text.includes("Harbor"));
await snap("12-activity");

await browser.close();
console.log("DONE");
