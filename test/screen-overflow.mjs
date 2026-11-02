// QA-30 invariant: every menu screen keeps all of its content reachable. A `.screen` is a flex column
// with `justify-content: center` and `overflow-y: auto`; when its content is taller than the viewport
// the overflow is split above and below, and the part above the top edge can never be scrolled to.
// Checks each menu screen at portrait, landscape-phone and desktop sizes: with scrollTop = 0 no visible
// element may start above the screen's top edge. Not a CI gate yet (fails on main until QA-30 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/screen-overflow.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const SIZES = [[390, 844], [844, 390], [740, 360], [932, 430], [1280, 720]];
const SCREENS = ['menu-main', 'menu-lobby', 'menu-online', 'menu-friends', 'menu-botpedia', 'menu-help', 'menu-pause'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const bad = [];
for (const [w, h] of SIZES) {
  const mobile = Math.min(w, h) < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForSelector('#btn-quick');
  for (const id of SCREENS) {
    const r = await page.evaluate((id) => {
      for (const s of document.querySelectorAll('#ui .screen')) s.classList.toggle('hidden', s.id !== id);
      document.querySelector('#ui').classList.remove('hidden');
      const scr = document.getElementById(id);
      scr.scrollTop = 0;
      const top = scr.getBoundingClientRect().top;
      const lost = [];
      for (const el of scr.children) {
        if (!el.offsetParent || getComputedStyle(el).visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < top - 1) lost.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}" top ${Math.round(r.top - top)}px`);
      }
      return lost;
    }, id);
    const tag = `${w}x${h} ${id}`.padEnd(24);
    if (r.length) { bad.push(tag); console.log(`FAIL ${tag} unreachable above the top: ${r.join(', ')}`); }
    else console.log(`ok   ${tag}`);
  }
  await ctx.close();
}
await browser.close();
console.log(`${SIZES.length * SCREENS.length} screen/viewport cases checked, ${bad.length} lose content above the top edge`);
process.exit(bad.length ? 1 : 0);
