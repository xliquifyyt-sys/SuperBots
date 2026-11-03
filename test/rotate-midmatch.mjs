// Orientation-change invariant: rotating a phone mid-match (portrait <-> landscape, during plan and during
// playback) must resize the canvas to the new viewport (backing store = css size x min(2, dpr)), keep every visible
// HUD element inside the screen, keep the match playable (FIRE still starts the resolve) and raise no page
// errors. Bots off-screen in portrait plan are a known separate bug (QA-6) and are not checked here.
// Added by the 2026-11-03 nightly QA run (passes on main).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/rotate-midmatch.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
let failed = 0;
const ok = (c, msg) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) failed++; };
for (const dpr of [1, 3]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector('#btn-quick'); await page.click('#btn-quick');
  const phase = () => page.evaluate(() => window.__superbots.match?.phase ?? null);
  const wait = async (p) => { for (let i = 0; i < 400; i++) { if (await phase() === p) return true; await page.waitForTimeout(100); } return false; };
  const check = async (label) => {
    const r = await page.evaluate(() => {
      const W = innerWidth, H = innerHeight, out = [];
      const c = document.querySelector('canvas'), cb = c.getBoundingClientRect();
      if (Math.abs(cb.width - W) > 1 || Math.abs(cb.height - H) > 1) out.push(`canvas css ${cb.width | 0}x${cb.height | 0} != viewport ${W}x${H}`);
      const d = Math.min(2, devicePixelRatio); // renderer.js caps the backing store at 2x
      const ew = Math.round(cb.width * d), eh = Math.round(cb.height * d);
      if (Math.abs(c.width - ew) > 2 || Math.abs(c.height - eh) > 2) out.push(`canvas backing ${c.width}x${c.height}, expected ~${ew}x${eh}`);
      for (const el of document.querySelectorAll('#hud *')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent) continue;
        const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
        if (b.right > W + 1 || b.left < -1 || b.bottom > H + 1 || b.top < -1) out.push(`${el.id || el.className} off-screen [${b.left | 0},${b.top | 0},${b.right | 0},${b.bottom | 0}]`);
      }
      return out;
    });
    ok(r.length === 0, `dpr ${dpr} ${label}${r.length ? ': ' + r.slice(0, 4).join('; ') : ''}`);
  };
  ok(await wait('plan'), `dpr ${dpr} quick match reaches plan`); await page.waitForTimeout(500);
  await check('portrait plan');
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(600);
  await check('rotated to landscape during plan');
  await page.click('#btn-fire');
  ok(await wait('resolve'), `dpr ${dpr} FIRE after rotation starts playback`); await page.waitForTimeout(700);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
  await check('rotated to portrait during playback');
  ok(await wait('plan'), `dpr ${dpr} next plan phase reached after rotation`); await page.waitForTimeout(500);
  await check('portrait plan after playback');
  ok(errs.length === 0, `dpr ${dpr} no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nrotate-midmatch passed');
process.exit(failed ? 1 : 0);
