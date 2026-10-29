// Capture app screens: each argument after the output is a JS snippet run
// before rendering one panel. Steps the app N frames if the snippet returns a number.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const [out, ...snips] = process.argv.slice(2);
const cols = Math.min(4, snips.length);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(300);
const info = await page.evaluate(({ snips, cols }) => {
  const app = window.__qc.app;
  app.loop.stop();
  const step = (n) => { for (let i = 0; i < n; i++) app.step(); };
  window.__step = step;
  const rows = Math.ceil(snips.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * 412; sheet.height = rows * 660;
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#333'; sc.fillRect(0, 0, sheet.width, sheet.height);
  sc.imageSmoothingEnabled = false;
  snips.forEach((js, i) => {
    const r = (0, eval)(js);
    if (typeof r === 'number') step(r);
    app.render();
    const x = (i % cols) * 412 + 4, y = Math.floor(i / cols) * 660 + 4;
    sc.drawImage(app.display.off, x, y, 408, 640);
    sc.fillStyle = '#fff'; sc.font = '12px monospace';
    sc.fillText(`#${i} ${app.screen}`, x + 2, y + 654);
  });
  document.body.innerHTML = '';
  document.body.appendChild(sheet);
  return { w: sheet.width, h: sheet.height };
}, { snips, cols });
await page.setViewportSize({ width: info.w, height: info.h });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: info.w, height: info.h } });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
console.log('saved', out);
