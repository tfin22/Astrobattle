// Phone held sideways: drag the left stick and press fire on the right.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(400);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
await page.evaluate(() => { window.__qc.app.display.touch = true; window.__qc.app['onResize'](); window.__qc.start(0, 0); window.__qc.app.game.setPhase('play'); });
const L = await page.evaluate(() => { const l = window.__qc.app.display.layout; return { mode: l.mode, fire: { x: l.fire.x / l.dpr, y: l.fire.y / l.dpr }, stick: { x: l.dpad.x / l.dpr, y: l.dpad.y / l.dpr } }; });
const x0 = await page.evaluate(() => window.__qc.app.game.player.x);
await touch('touchStart', [[L.stick.x, L.stick.y]]);
for (let i = 1; i <= 6; i++) { await touch('touchMove', [[L.stick.x - i * 8, L.stick.y]]); await page.waitForTimeout(16); }
await page.waitForTimeout(500);
await touch('touchStart', [[L.stick.x - 48, L.stick.y], [L.fire.x, L.fire.y]]);
await page.waitForTimeout(80);
await touch('touchEnd', []);
await page.waitForTimeout(100);
const r = await page.evaluate(() => ({ x: window.__qc.app.game.player.x, shots: window.__qc.app.game.stats.shotsFired }));
const ok = L.mode === 'sides' && r.x < x0 - 15 && r.shots >= 1;
console.log(`${ok ? 'PASS' : 'FAIL'} sideways: stick moves the ship left and fire fires`, JSON.stringify({ mode: L.mode, x0, ...r }));
await browser.close();
process.exit(ok ? 0 : 1);
