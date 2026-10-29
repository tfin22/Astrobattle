// Screenshot the game on different screen shapes.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const shapes = [
  { name: 'monitor-1920x1080', w: 1920, h: 1080, dpr: 1, touch: false, setup: '' },
  { name: 'monitor-bezel', w: 1920, h: 1080, dpr: 1, touch: false, setup: "__qc.app.settings.bezel=true; __qc.app.applySettings();" },
  { name: 'laptop-1366x768', w: 1366, h: 768, dpr: 1, touch: false, setup: '' },
  { name: 'narrow-window', w: 700, h: 900, dpr: 1, touch: false, setup: '' },
  { name: 'tablet-landscape', w: 1180, h: 820, dpr: 2, touch: true, setup: '' },
  { name: 'phone-landscape', w: 844, h: 390, dpr: 3, touch: true, setup: '' },
];
const only = process.argv[2];
const browser = await chromium.launch();
for (const s of shapes) {
  if (only && !s.name.startsWith(only)) continue;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr, isMobile: s.touch, hasTouch: s.touch });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
  await page.waitForTimeout(300);
  await page.evaluate(`${s.setup} __qc.start(0,0); __qc.app.game.setPhase('play'); __qc.autoplay(240);`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/${s.name}.png` });
  await ctx.close();
  console.log('saved', s.name);
}
await browser.close();
