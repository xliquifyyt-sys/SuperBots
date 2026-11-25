// Invariant: in a solo (local clock) match, the pause menu freezes the plan timer and the playback sim,
// blocks clicks on the action bar underneath, and Resume restarts the clock. Phone and desktop viewports.
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/pause-freeze.mjs
import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
for (const [w, h] of [[390, 844], [1280, 720]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#btn-quick'); await p.click('#btn-quick');
  const ph = () => p.evaluate(() => window.__superbots.match?.phase);
  for (let i = 0; i < 150 && (await ph()) !== 'plan'; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(1000);
  const t1 = Number(await p.textContent('#phase-timer'));
  await p.click('#btn-pause'); await p.waitForTimeout(3500);
  const t2 = Number(await p.textContent('#phase-timer'));
  check(t1 === t2 && (await ph()) === 'plan', `${w}x${h} plan timer frozen while paused (${t1} -> ${t2})`);
  let through = false;
  try { await p.click('#btn-fire', { timeout: 1000 }); through = (await ph()) !== 'plan'; } catch { /* blocked by overlay: expected */ }
  check(!through, `${w}x${h} FIRE under the pause menu is not clickable`);
  await p.click('#btn-resume'); await p.waitForTimeout(2200);
  const t3 = Number(await p.textContent('#phase-timer'));
  check(t3 < t2, `${w}x${h} timer runs again after Resume (${t2} -> ${t3})`);
  check(errs.length === 0, `${w}x${h} no page errors ${errs.join('; ')}`);
  await ctx.close();
}
await b.close();
console.log(fails ? `\n${fails} pause check(s) failed` : '\nall pause checks passed');
process.exit(fails ? 1 : 0);
