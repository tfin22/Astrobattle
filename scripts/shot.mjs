// Screenshot the built game in headless Chromium at phone size.
// Usage: node scripts/shot.mjs out.png [jsToRunBeforeShot] [waitMs]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const out = process.argv[2] ?? 'shots/shot.png';
const script = process.argv[3] ?? '';
const wait = Number(process.argv[4] ?? 600);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(400);
if (script) {
  const r = await page.evaluate(script);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
}
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
console.log('saved', out);
