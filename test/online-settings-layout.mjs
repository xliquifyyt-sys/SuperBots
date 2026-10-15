// M0-13: every #online-settings button must be reachable (fully inside the viewport once scrolled
// into view, never clipped by the panel) and at least 48px tall, at phone portrait, phone landscape
// and desktop sizes. No #online-settings text may be below 12px at 390 wide.
// Usage: CHROMIUM_PATH=... node test/online-settings-layout.mjs   (SHOT_DIR=dir to keep JPEG screenshots)
import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium } from 'playwright-core';
import { startServer } from '../server/index.js';

const shotDir = process.env.SHOT_DIR || '';
if (shotDir) mkdirSync(shotDir, { recursive: true });

const app = await startServer({
  port: 0,
  dataFile: join(mkdtempSync(join(tmpdir(), 'superbots-layout-')), 'superbots.sqlite'),
});
const url = `http://127.0.0.1:${app.port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

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
    await page.fill('#auth-username', `Lay${w}`);
    await page.click('#btn-guest');
    await page.locator('#profile-code').waitFor({ timeout: 10000 });
    await page.click('#btn-online-create');
    await page.locator('#online-code').waitFor({ timeout: 10000 });
    await page.locator('#online-settings button').first().waitFor({ timeout: 10000 });

    const buttons = page.locator('#online-settings button');
    const n = await buttons.count();
    check(n >= 30, `${w}x${h} host settings rendered ${n} buttons`);
    const bad = [];
    let minH = Infinity;
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      await b.scrollIntoViewIfNeeded();
      const r = await b.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        // Clipped by any scrolling/overflow-hidden ancestor (other than the scroller we just used)?
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== 'visible' && p.scrollWidth > p.clientWidth + 1) {
            const pr = p.getBoundingClientRect();
            if (rect.left < pr.left - 0.5 || rect.right > pr.right + 0.5) clipped = true;
          }
        }
        return { t: el.textContent, l: rect.left, r: rect.right, top: rect.top, b: rect.bottom, h: rect.height, clipped,
          vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight };
      });
      minH = Math.min(minH, r.h);
      const inside = r.l >= -0.5 && r.r <= r.vw + 0.5 && r.top >= -0.5 && r.b <= r.vh + 0.5;
      if (!inside || r.clipped || r.h < 48) bad.push(`"${r.t}" [${r.l.toFixed(0)},${r.top.toFixed(0)} ${(r.r - r.l).toFixed(0)}x${r.h.toFixed(0)}]${r.clipped ? ' clipped' : ''}`);
    }
    check(bad.length === 0, `${w}x${h} all ${n} settings buttons inside viewport and >=48px tall (min ${minH.toFixed(0)}px)` + (bad.length ? `\n     ${bad.join('\n     ')}` : ''));

    // Panel containment: the grid must not be wider than the page.
    const over = await page.evaluate(() => {
      const g = document.getElementById('online-settings');
      const r = g.getBoundingClientRect();
      return { right: r.right, left: r.left, vw: document.documentElement.clientWidth, sw: g.scrollWidth, cw: g.clientWidth };
    });
    check(over.left >= 0 && over.right <= over.vw + 0.5 && over.sw <= over.cw + 1,
      `${w}x${h} settings grid stays within the viewport (${over.left.toFixed(0)}..${over.right.toFixed(0)} of ${over.vw}, scroll ${over.sw}/${over.cw})`);

    if (w === 390) {
      const tiny = await page.evaluate(() => {
        const out = [];
        const walk = document.createTreeWalker(document.getElementById('online-settings'), NodeFilter.SHOW_TEXT);
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent.trim()) continue;
          const f = parseFloat(getComputedStyle(t.parentElement).fontSize);
          if (f < 12) out.push(`${t.textContent.trim()} (${f}px)`);
        }
        return out;
      });
      check(tiny.length === 0, `${w}x${h} no #online-settings text below 12px` + (tiny.length ? ': ' + tiny.join(', ') : ''));
    }
    check(errors.length === 0, `${w}x${h} no page errors` + (errors.length ? ': ' + errors.join(' | ') : ''));

    if (shotDir) {
      await page.locator('#online-lobby .settings-col h2').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(shotDir, `online-settings-${w}x${h}.jpg`), type: 'jpeg', quality: 70 });
      if (w < 1000) {
        await page.locator('#online-settings .setting').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(shotDir, `online-settings-${w}x${h}-map.jpg`), type: 'jpeg', quality: 70 });
      }
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
console.log('online settings layout passed');
process.exit(0);
