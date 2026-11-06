// QA-31 invariant: during the plan phase the aim readout ("missile · angle 39° · power 100%", #aim-readout,
// bottom-left) must not sit under or over any action button or FIRE in #plan-bar. The readout is hidden
// only at <=640px wide, so landscape phones (740..932 wide) and small laptops get both in the same strip.
// Starts a Quick match at each size, drags an aim so the readout holds its longest normal text, and
// reports every overlap. Not a CI gate yet (fails on main until QA-31 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/aim-readout-overlap.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const SIZES = [[390, 844], [740, 360], [844, 390], [932, 430], [1024, 600], [1280, 720]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const bad = [];
for (const [w, h] of SIZES) {
  const mobile = Math.min(w, h) < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#btn-quick');
  await page.click('#btn-quick');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const ph = await page.evaluate(() => window.__superbots.match?.phase ?? null);
    if (ph === 'plan' && await page.isVisible('#btn-fire')) break;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
  // drag an aim so the readout shows "missile · angle NN° · power NNN%"
  const cx = w / 2, cy = h * 0.45;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx - 120, cy + 90, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const ro = document.getElementById('aim-readout');
    if (!ro || !ro.offsetParent || getComputedStyle(ro).display === 'none') return { hidden: true, hits: [] };
    const a = ro.getBoundingClientRect();
    const hits = [];
    for (const el of document.querySelectorAll('#plan-bar button, #plan-bar .act, #btn-fire')) {
      if (!el.offsetParent) continue;
      const b = el.getBoundingClientRect();
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 1 && iy > 1) hits.push(`${el.id || el.className} by ${Math.round(ix)}x${Math.round(iy)}px`);
    }
    return { hidden: false, text: ro.textContent, box: [a.left, a.top, a.right, a.bottom].map(Math.round), hits: [...new Set(hits)] };
  });
  const tag = `${w}x${h}`.padEnd(10);
  if (r.hidden) console.log(`ok   ${tag} readout hidden`);
  else if (r.hits.length) { bad.push(tag); console.log(`FAIL ${tag} "${r.text}" [${r.box}] overlaps ${r.hits.join(', ')}`); }
  else console.log(`ok   ${tag} "${r.text}" [${r.box}] clear of the action bar`);
  await ctx.close();
}
await browser.close();
console.log(`${SIZES.length} viewports checked, ${bad.length} put the aim readout on top of the action bar`);
process.exit(bad.length ? 1 : 0);
