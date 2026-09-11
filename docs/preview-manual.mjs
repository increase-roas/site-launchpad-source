import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(here, "manual-assets", "manual.html");
const outDir = path.join(here, "manual-assets");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1160 } });
await page.goto(`file:///${html.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(outDir, "preview-cover.png"), fullPage: false });
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, "preview-clients.png"), fullPage: false });
await page.evaluate(() => window.scrollTo(0, 4200));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, "preview-overview.png"), fullPage: false });
await browser.close();
console.log("previews written");
