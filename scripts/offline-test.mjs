// Serve dist on localhost, let the service worker cache it, then reload offline.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const url = process.argv[2] ?? 'http://localhost:8123/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(url);
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true), null, { timeout: 10000 });
await page.waitForTimeout(1000);
const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(800);
const ok = await page.evaluate(() => !!(window.__qc && window.__qc.app && document.querySelector('canvas')));
console.log(JSON.stringify({ manifest: { name: manifest.name, display: manifest.display, orientation: manifest.orientation, icons: manifest.icons.length }, offlineReloadWorks: ok }));
await browser.close();
