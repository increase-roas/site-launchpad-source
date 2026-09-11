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
      return;
    }
    await page.waitForTimeout(400);
  }
}

await page.goto(`${BASE}/workspace/15`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Build progress") && text.includes("Harbor"));
await page.locator('nav[aria-label="Client sections"] a[href$="/launch"]').click();
await waitUntil(text => text.includes("Readiness") || text.includes("Recommended next step"));
await page.screenshot({ path: path.join(outDir, "11-launch.png"), fullPage: false });
console.log("SHOT launch", await page.locator("body").innerText().then(t => t.slice(0, 200)));

await page.goto(`${BASE}/activity`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Harbor") || text.includes("Hot Tub"));
await page.screenshot({ path: path.join(outDir, "12-activity.png"), fullPage: false });
console.log("SHOT activity");

await browser.close();
console.log("DONE");
