// Frame-cost check at the busiest moment, with the CPU throttled to
// approximate a mid-range phone. Measures real rAF frames for ~4 s.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const throttle = Number(process.argv[2] ?? 4);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(500);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
for (const crt of [false, true]) {
  const r = await page.evaluate(async (crt) => {
    const app = window.__qc.app;
    app.settings.crt = crt;
    app.applySettings();
    window.__qc.stress();
    // Time our own work per frame (sim steps + render + present).
    const times = [];
    const origStep = app.step.bind(app);
    const origRender = app.render.bind(app);
    let acc = 0;
    app.step = () => { const t = performance.now(); origStep(); acc += performance.now() - t; };
    app.render = () => { const t = performance.now(); origRender(); acc += performance.now() - t; times.push(acc); acc = 0; };
    await new Promise((res) => setTimeout(res, 4000));
    app.step = origStep;
    app.render = origRender;
    times.sort((a, b) => a - b);
    const g = app.game;
    return {
      crt, frames: times.length, phase: g.phase,
      particles: g.particles.length, enemies: g.enemies.length,
      median: times[times.length >> 1].toFixed(2), p95: times[Math.floor(times.length * 0.95)].toFixed(2), max: times[times.length - 1].toFixed(2),
    };
  }, crt);
  console.log(`throttle ${throttle}x`, JSON.stringify(r));
}
await browser.close();
