import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const BASE = "http://127.0.0.1:3000";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "manual-assets");
const CLIENT = 15;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30000);

async function waitUntil(ok, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.locator("body").innerText();
    if (ok(text)) {
      await page.waitForTimeout(700);
      return text;
    }
    const retry = page.locator("text=Try again");
    if ((await retry.count()) > 0 && (await retry.first().isVisible().catch(() => false))) {
      await retry.first().click().catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  throw new Error("waitUntil timeout");
}

async function snap(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
  console.log("SHOT", name, page.url());
}

await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Total clients") && text.includes("Harbor"));
await page.locator("text=Harbor & Heat Spas").first().click();
await waitUntil(text => text.includes("Build progress") && text.includes("Client setup"));
await snap("03-overview");

await page.goto(`${BASE}/workspace/${CLIENT}/configuration?tab=media`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Photos") && !text.includes("Opening client configuration"));
await snap("06-media");

await page.goto(`${BASE}/workspace/${CLIENT}/launch`, { waitUntil: "domcontentloaded" });
await waitUntil(text =>
  (text.includes("Readiness") || text.includes("Preview") || text.includes("Publish"))
  && !text.includes("Choose a client"),
);
await snap("11-launch");

await page.goto(`${BASE}/activity`, { waitUntil: "domcontentloaded" });
await waitUntil(text => text.includes("Current state by client") || text.includes("No clients yet"));
await snap("12-activity");

await browser.close();
console.log("DONE");
