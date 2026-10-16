// QA-12 invariant: the lobby map picker (#map-list) meets the same rules the M0-11/M0-13 work set for
// the rest of the lobby: every text node at least 12px, every map button at least 48px tall, and no
// horizontal overflow at 390x844 and 1280x720. Not a CI gate yet (fails on main until QA-12 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/lobby-maplist.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const bad = [];
for (const [w, h] of [[390, 844], [1280, 720]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForSelector('#btn-quick');
  await page.click('[data-go="menu-lobby"]');
  await page.waitForSelector('#map-list button');
  const r = await page.evaluate(() => {
    const list = document.querySelector('#map-list');
    const lr = list.getBoundingClientRect();
    const small = [], short = [], over = [];
    for (const el of list.querySelectorAll('*')) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (hasText && fs < 12) small.push(`"${el.textContent.trim()}" ${fs}px`);
    }
    for (const b of list.querySelectorAll('button')) {
      const br = b.getBoundingClientRect();
      if (br.height < 48) short.push(`${(b.firstChild?.textContent || b.textContent).trim()} ${Math.round(br.height)}px`);
      if (br.right > lr.right + 1 || br.right > window.innerWidth) over.push(b.textContent.trim());
    }
    return { small: [...new Set(small)], short, over, n: list.querySelectorAll('button').length };
  });
  console.log(`${w}x${h}: ${r.n} map buttons, ${r.small.length} small text, ${r.short.length} short buttons, ${r.over.length} overflowing`);
  if (r.small.length) bad.push(`${w}x${h} text below 12px: ${r.small.slice(0, 4).join(', ')}`);
  if (r.short.length) bad.push(`${w}x${h} map buttons under 48px: ${r.short.slice(0, 4).join(', ')}${r.short.length > 4 ? ' …' : ''}`);
  if (r.over.length) bad.push(`${w}x${h} map buttons overflow: ${r.over.join(', ')}`);
  await ctx.close();
}
await browser.close();
if (bad.length) { console.error('FAIL lobby map list:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('lobby map list checks passed');
