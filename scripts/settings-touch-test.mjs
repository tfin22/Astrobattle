// Tap the "<" and ">" arrows in Settings and Practice with real touches.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.resolve(process.argv[2] ?? 'dist/index.html')).href);
await page.waitForTimeout(400);
const cdp = await ctx.newCDPSession(page);
const tap = async (x, y) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await page.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
};
const L = await page.evaluate(() => { const l = window.__qc.app.display.layout; return { px: l.play.x / l.dpr, py: l.play.y / l.dpr, s: l.scale / l.dpr }; });
const g2c = (gx, gy) => [L.px + gx * L.s, L.py + gy * L.s];
// Find where the arrows of a settings row are drawn, by scanning the framebuffer.
const arrows = (row) => page.evaluate((row) => {
  const app = window.__qc.app;
  app.render();
  const fb = app.fb;
  const y = 40 + row * 16 + 3;
  const xs = [];
  for (let x = 100; x < 204; x++) if (fb.px[y * 204 + x]) xs.push(x);
  return { left: xs[0] + 2, right: xs[xs.length - 1] - 2 };
}, row);
const results = [];
const check = (name, ok, info) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}  ${JSON.stringify(info)}`);

await page.evaluate(() => { const a = window.__qc.app; a.settings.volume = 0.5; a.settings.startShips = 4; a.setScreen('settings'); });
await page.waitForTimeout(200);
const VOL = 5, SHIPS = 1;
let a = await arrows(VOL);
await tap(...g2c(a.left, 40 + VOL * 16 + 3));
let v = await page.evaluate(() => window.__qc.app.settings.volume);
check('VOLUME "<" turns it down', v < 0.5 - 0.01, { v });
await tap(...g2c(a.right, 40 + VOL * 16 + 3));
await tap(...g2c(a.right, 40 + VOL * 16 + 3));
v = await page.evaluate(() => window.__qc.app.settings.volume);
check('VOLUME ">" turns it up', v > 0.5 + 0.01, { v });
a = await arrows(SHIPS);
await tap(...g2c(a.left, 40 + SHIPS * 16 + 3));
let s = await page.evaluate(() => window.__qc.app.settings.startShips);
check('SHIPS "<" goes down', s === 3, { s });
await tap(...g2c(a.right, 40 + SHIPS * 16 + 3));
s = await page.evaluate(() => window.__qc.app.settings.startShips);
check('SHIPS ">" goes up', s === 4, { s });
// Practice: mission picker "<" goes back.
await page.evaluate(() => { const a = window.__qc.app; a.practice.mission = 2; a.progress.bestLevel = 5; a.practice.level = 3; a.setScreen('practice'); });
await page.waitForTimeout(200);
const pa = await page.evaluate(() => {
  const app = window.__qc.app; app.render(); const fb = app.fb;
  const scan = (y) => { const xs = []; for (let x = 0; x < 204; x++) if (fb.px[y * 204 + x] && fb.px[y * 204 + x] > 3) xs.push(x); return xs; };
  const m = scan(96 + 3); const r = scan(128 + 3);
  return { mL: m[0] + 2, mR: m[m.length - 1] - 2, rL: r[0] + 2, rR: r[r.length - 1] - 2 };
});
await tap(...g2c(pa.mL, 99));
let p = await page.evaluate(() => ({ ...window.__qc.app.practice }));
check('PRACTICE mission "<" goes back', p.mission === 1, p);
await tap(...g2c(pa.rL, 131));
p = await page.evaluate(() => ({ ...window.__qc.app.practice }));
check('PRACTICE rank "<" goes down', p.level === 2, p);
await tap(...g2c(pa.rR, 131));
p = await page.evaluate(() => ({ ...window.__qc.app.practice }));
check('PRACTICE rank ">" goes up', p.level === 3, p);
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
