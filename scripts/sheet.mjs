// Contact sheet: run a setup, then capture the arcade picture after each
// chunk of autoplay frames, side by side at 2x.
// Usage: node scripts/sheet.mjs out.png "<setup js>" "300,300,300,300" [cols]
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');

const [out, setup, chunksArg, colsArg] = process.argv.slice(2);
const chunks = (chunksArg ?? '300,300,300,300').split(',').map(Number);
const cols = Number(colsArg ?? chunks.length);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(300);
await page.evaluate(`window.__qc.app.loop.stop()`);
if (setup) await page.evaluate(setup);
const info = await page.evaluate(({ chunks, cols }) => {
  const qc = window.__qc;
  const app = qc.app;
  const rows = Math.ceil(chunks.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * 412;
  sheet.height = rows * 660;
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#333';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  sc.imageSmoothingEnabled = false;
  const notes = [];
  chunks.forEach((n, i) => {
    if (n > 0) notes.push(JSON.stringify(qc.autoplay(n)));
    app.render();
    const x = (i % cols) * 412 + 4;
    const y = Math.floor(i / cols) * 660 + 4;
    sc.drawImage(app.display.off, x, y, 408, 640);
    sc.fillStyle = '#fff';
    sc.font = '12px monospace';
    sc.fillText(`#${i} f${app.game ? app.game.frame : app.frame}`, x + 2, y + 654);
  });
  document.body.innerHTML = '';
  document.body.style.overflow = 'visible';
  document.body.appendChild(sheet);
  return { notes, w: sheet.width, h: sheet.height };
}, { chunks, cols });
await page.setViewportSize({ width: info.w, height: info.h });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: info.w, height: info.h } });
console.log(info.notes.join('\n'));
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
