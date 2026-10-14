// M0-07: the online lobby's map labels must equal MAPS[id].name for every id, with Random first.
// Renders the real lobby in Chromium against a local server and reads the Map setting buttons.
// Usage: CHROMIUM_PATH=... node test/online-maps.mjs   (SHOT_DIR=dir to keep screenshots)
import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium } from 'playwright-core';
import { startServer } from '../server/index.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const shotDir = process.env.SHOT_DIR || '';
if (shotDir) mkdirSync(shotDir, { recursive: true });

const app = await startServer({
  port: 0,
  dataFile: join(mkdtempSync(join(tmpdir(), 'superbots-maps-')), 'superbots.sqlite'),
});
const url = `http://127.0.0.1:${app.port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const expected = ['Random', ...MAP_IDS.map((id) => MAPS[id].name)];
let failed = 0;
const check = (ok, msg) => { if (ok) console.log('ok  ', msg); else { failed++; console.log('FAIL', msg); } };

try {
  const viewports = [[390, 844], [844, 390], [1280, 720]];
  for (const [w, h] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url);
    await page.click('#btn-online');
    await page.fill('#auth-username', `Map${w}`);
    await page.click('#btn-guest');
    await page.locator('#profile-code').waitFor({ timeout: 10000 });
    await page.click('#btn-online-create');
    await page.locator('#online-code').waitFor({ timeout: 10000 });

    const mapSetting = page.locator('#online-settings .setting').filter({ has: page.locator('label', { hasText: /^Map$/ }) });
    await mapSetting.locator('button').first().waitFor({ timeout: 10000 });
    const labels = (await mapSetting.locator('button').allTextContents()).map((t) => t.trim());
    check(JSON.stringify(labels) === JSON.stringify(expected),
      `${w}x${h} map labels match maps.js (${labels.length}/${expected.length})` + (JSON.stringify(labels) === JSON.stringify(expected) ? '' : `\n     got ${JSON.stringify(labels)}\n     want ${JSON.stringify(expected)}`));

    // Picking a map by its real name is accepted by the server and highlighted.
    const pick = MAPS.frozenkeel.name;
    await mapSetting.locator('button', { hasText: pick }).click();
    await page.waitForFunction((name) => {
      const set = [...document.querySelectorAll('#online-settings .setting')].find((s) => s.querySelector('label')?.textContent === 'Map');
      return [...(set?.querySelectorAll('button.on') || [])].some((b) => b.textContent === name);
    }, pick, { timeout: 10000 });
    check(true, `${w}x${h} selecting "${pick}" round-trips through the server`);

    const small = await mapSetting.locator('button').evaluateAll((bs) => bs
      .map((b) => ({ t: b.textContent, h: b.getBoundingClientRect().height, f: parseFloat(getComputedStyle(b).fontSize) })));
    console.log(`     ${w}x${h} map button heights ${Math.min(...small.map((s) => s.h)).toFixed(0)}-${Math.max(...small.map((s) => s.h)).toFixed(0)}px, font ${Math.min(...small.map((s) => s.f))}px`);
    check(errors.length === 0, `${w}x${h} no page errors` + (errors.length ? ': ' + errors.join(' | ') : ''));
    if (shotDir) {
      await mapSetting.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(shotDir, `online-maps-${w}x${h}.png`) });
    }
    await ctx.close();
  }
} catch (err) {
  failed++;
  console.error(err);
} finally {
  await browser.close();
  app.close();
}
if (failed) process.exit(1);
console.log('online lobby map labels passed');
process.exit(0);
