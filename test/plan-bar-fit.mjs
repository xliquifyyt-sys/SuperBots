// QA-32 invariant: in the plan phase every action button (#plan-bar .act) and FIRE must sit fully inside
// the viewport. At <=640px the bar is 4 x 64px buttons + 84px FIRE + gaps = 368px, wider than a 360px
// Android phone, so JUMP and FIRE are cut at the screen edges.
// Starts a Quick match at each portrait phone width and reports every button that leaves the screen.
// Not a CI gate yet (fails on main until QA-32 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/plan-bar-fit.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const SIZES = [[320, 568], [360, 640], [360, 800], [375, 667], [390, 844], [412, 915]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const bad = [];
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
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
  const out = await page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight, res = [];
    for (const el of document.querySelectorAll('#plan-bar .act, #btn-fire')) {
      if (!el.offsetParent) continue;
      const b = el.getBoundingClientRect();
      if (b.left < -0.5 || b.right > W + 0.5 || b.top < -0.5 || b.bottom > H + 0.5)
        res.push(`${el.id} [${[b.left, b.top, b.right, b.bottom].map(Math.round)}]`);
    }
    return res;
  });
  const tag = `${w}x${h}`.padEnd(10);
  if (out.length) { bad.push(tag); console.log(`FAIL ${tag} off-screen: ${out.join(', ')}`); }
  else console.log(`ok   ${tag} all action buttons and FIRE on screen`);
  await ctx.close();
}
await browser.close();
console.log(`${SIZES.length} viewports checked, ${bad.length} cut an action button or FIRE at the screen edge`);
process.exit(bad.length ? 1 : 0);
