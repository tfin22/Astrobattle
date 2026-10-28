// Drive the built game with real touch events on a 390x844 phone viewport.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(500);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(120); };
const state = () => page.evaluate(() => {
  const a = window.__qc.app;
  const g = a.game;
  return { screen: a.screen, phase: g?.phase, x: g?.player.x, y: g?.player.y, shots: g?.stats.shotsFired, paused: a.paused, debug: a.debug.visible, touch: a.display.touch };
});
const L = await page.evaluate(() => { const l = window.__qc.app.display.layout; return { px: l.play.x / l.dpr, py: l.play.y / l.dpr, s: l.scale / l.dpr, fire: { x: l.fire.x / l.dpr, y: l.fire.y / l.dpr }, ctrlY: l.controls.y / l.dpr }; });
const g2c = (gx, gy) => [L.px + gx * L.s, L.py + gy * L.s];
const results = [];
const check = (name, ok, info) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  ' + JSON.stringify(info) : ''}`); };

await tap(195, 400); // insert coin
let s = await state();
check('tap on the title inserts a coin', s.screen === 'menu', s);
check('touch layout active', s.touch === true, s);
await page.waitForTimeout(300);
await tap(...g2c(102, 152)); // START
s = await state();
check('tapping START begins a game', s.screen === 'game' && s.phase === 'card', s);
await page.waitForTimeout(900);
await tap(L.fire.x, L.fire.y); // skip card
await page.waitForTimeout(200);
s = await state();
check('FIRE skips the title card', s.phase === 'play', s);
const x0 = s.x;
// Drag the floating stick to the left and hold.
const sx = 90, sy = L.fire.y;
await touch('touchStart', [[sx, sy]]);
for (let i = 1; i <= 6; i++) { await touch('touchMove', [[sx - i * 8, sy]]); await page.waitForTimeout(16); }
await page.waitForTimeout(600);
s = await state();
check('dragging the stick left moves the ship left', s.x < x0 - 20, { x0, x: s.x });
// Fire while still holding the stick (two thumbs).
await touch('touchStart', [[sx - 48, sy], [L.fire.x, L.fire.y]]);
await page.waitForTimeout(80);
await touch('touchEnd', [[sx - 48, sy]]);
await page.waitForTimeout(80);
await touch('touchEnd', []);
await page.waitForTimeout(150);
s = await state();
check('FIRE with the second thumb fires', s.shots >= 1, s);
await page.screenshot({ path: 'shots/touch-play.png' });
// Pause button, top right.
await tap(...g2c(194, 8));
s = await state();
check('pause button pauses', s.paused === true, s);
await tap(...g2c(102, 160));
s = await state();
check('tap RESUME resumes', s.paused === false, s);
// Three fingers -> debug overlay.
await touch('touchStart', [[100, 300], [200, 300], [300, 300]]);
await page.waitForTimeout(60);
await touch('touchEnd', []);
await page.waitForTimeout(150);
s = await state();
check('three-finger touch opens the debug overlay', s.debug === true, s);
await page.screenshot({ path: 'shots/touch-debug.png' });
console.log(results.join('\n'));
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
