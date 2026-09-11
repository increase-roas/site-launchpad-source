import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sky/AppData/Local/Temp/launchpad-manual-tools/node_modules/playwright-core");

const here = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(here, "manual-assets", "manual.html");
const out = path.join(here, "Site-Launchpad-Easy-Manual.pdf");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.goto(`file:///${html.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  margin: { top: "0.45in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
});
await browser.close();
console.log("PDF", out);
