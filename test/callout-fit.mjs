// QA-19 invariant: the special-move callout (icon + name pill that pops over a bot when it casts a
// special, Renderer.drawCallouts) must fit its text inside its pill, and the pill must stay inside the
// canvas even when the caster stands at the screen edge. Drives the real drawCallouts with a recording
// 2D context for every bot's s1/s2 at zoom 22 and 40 px/unit, caster at screen centre and at x=8px.
// Not a CI gate yet (fails on main until QA-19 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/callout-fit.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async () => {
  const { BOTS } = await import('/src/core/defs.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const W = 390, H = 844, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const real = canvas.getContext('2d'); const bad = []; let checked = 0;
  for (const zoom of [22, 40]) for (const sx of [W / 2, 8, W - 8]) for (const bot of Object.values(BOTS)) for (const sp of [bot.s1, bot.s2]) {
    let pill = null, text = null;
    const ctx = new Proxy(real, {
      get(t, k) {
        if (k === 'roundRect') return (x, y, w, h, r) => { pill = { x, y, w, h }; return t.roundRect(x, y, w, h, r); };
        if (k === 'fillText') return (s, x, y) => { const m = t.measureText(s); const al = t.textAlign;
          const left = al === 'center' ? x - m.width / 2 : al === 'right' || al === 'end' ? x - m.width : x;
          if (s === sp.name.toUpperCase()) text = { s, left, right: left + m.width }; return t.fillText(s, x, y); };
        const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    const fake = { ctx, cam: { zoom }, userZoom: 1, dt: 0.3, world: { bots: [{ x: 0, y: 0 }] },
      toScreen: () => [sx, H / 2], callouts: [{ bot: 0, kind: sp.id, name: sp.name, color: '#fff', t: 0, life: 1 }] };
    Renderer.prototype.drawCallouts.call(fake);
    checked++;
    const where = `${bot.id} ${sp.name} zoom ${zoom} x=${sx}`;
    if (!pill || !text) { bad.push(`${where}: no pill/text drawn`); continue; }
    if (text.right > pill.x + pill.w + 0.5 || text.left < pill.x - 0.5) bad.push(`${where}: "${text.s}" ${Math.round(text.right - text.left)}px wide overflows its ${Math.round(pill.w)}px pill by ${Math.round(Math.max(text.right - pill.x - pill.w, pill.x - text.left))}px`);
    const L = Math.min(pill.x, text.left), R = Math.max(pill.x + pill.w, text.right);
    if (L < -0.5 || R > W + 0.5) bad.push(`${where}: callout off-canvas [${Math.round(L)}, ${Math.round(R)}] of ${W}px`);
  }
  return { bad, checked };
});
await browser.close();
for (const b of res.bad) console.log('  ' + b);
console.log(`${res.checked} callouts checked, ${res.bad.length} problems`);
process.exit(res.bad.length ? 1 : 0);
