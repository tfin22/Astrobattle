// Drive the game with only fire keys (Space, Z, Enter) on a desktop screen.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
await page.waitForTimeout(400);
const state = () => page.evaluate(() => ({ screen: window.__qc.app.screen, phase: window.__qc.app.game?.phase, shots: window.__qc.app.game?.stats.shotsFired ?? 0 }));
const results = [];
const check = (name, ok, info) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}  ${JSON.stringify(info)}`);
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };

await press('Enter');
let s = await state();
check('Enter on the title inserts a coin (menu)', s.screen === 'menu', s);
await page.waitForTimeout(200);
await press('Enter');
s = await state();
check('Enter on the menu selects START', s.screen === 'game', s);
await page.waitForTimeout(900);
await press('z');
await page.waitForTimeout(100);
s = await state();
check('Z skips the mission card', s.phase === 'play', s);
for (const k of ['Space', 'z', 'Enter']) {
  const before = (await state()).shots;
  await press(k);
  const after = (await state()).shots;
  check(`${k} fires`, after > before, { before, after });
}
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
