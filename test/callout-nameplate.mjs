// QA-26 invariant: the special-move callout pill (Renderer.drawCallouts, the dark rounded box with the special's
// icon that pops over a bot when it casts) must not sit on that bot's own nameplate — its name text or its HP chip —
// while it is still drawn at alpha >= 0.5. Drives the real drawCallouts frame by frame (dt = 1/60 s) with a recording
// 2D context for every bot's s1/s2 at zoom 22 and 40 px/unit, and measures each frame's pill against the name text
// box and HP chip box computed with drawBots' own nameplate formulas (same geometry as test/label-tag-overlap.mjs).
// A callout fails when, at any frame with alpha >= 0.5, more than 25% of the name box or of the HP chip is covered.
// Not a CI gate yet (fails on main until QA-26 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/callout-nameplate.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async () => {
  const { BOTS, PHYS } = await import('/src/core/defs.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const NAME = 'Mira';
  const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 844;
  const real = canvas.getContext('2d');
  const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (a) => (a.x1 - a.x0) * (a.y1 - a.y0);
  const out = [];
  for (const z of [22, 40]) {
    // nameplate geometry, copied from drawBots (bot at screen 0,0)
    const r = PHYS.botRadius * z;
    const bw = Math.max(40, r * 3.1), bh = Math.max(6, z * 0.2), by = -r * 1.75 - z * 0.5;
    const chipW = Math.max(16, z * 0.62), capH = bh + Math.max(3, z * 0.1);
    const capX = -bw / 2 - chipW * 0.55;
    const chip = { x0: capX, x1: capX + chipW, y0: by - (capH - bh) / 2, y1: by - (capH - bh) / 2 + capH };
    const nf = Math.max(10, Math.round(z * 0.32)); real.font = `bold ${nf}px sans-serif`;
    const nw = real.measureText(NAME).width, nb = by - z * 0.12;
    const name = { x0: -nw / 2, x1: nw / 2, y0: nb - nf, y1: nb };
    for (const bot of Object.values(BOTS)) for (const sp of [bot.s1, bot.s2]) {
      let pill = null;
      const ctx = new Proxy(real, {
        get(t, k) {
          if (k === 'roundRect') return (x, y, w, h, rr) => { if (!pill) pill = { x0: x, x1: x + w, y0: y, y1: y + h, alpha: t.globalAlpha }; return t.roundRect(x, y, w, h, rr); };
          const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, k, v) { t[k] = v; return true; },
      });
      const fake = { ctx, cam: { zoom: z }, userZoom: 1, dt: 1 / 60, world: { bots: [{ x: 0, y: 0 }] },
        toScreen: () => [0, 0], callouts: [{ bot: 0, kind: sp.id, name: sp.name, color: '#fff', t: 0, life: 1 }] };
      let worstName = 0, worstChip = 0, at = null, frames = 0;
      while (fake.callouts.length && frames < 600) {
        pill = null; real.globalAlpha = 1;
        Renderer.prototype.drawCallouts.call(fake); frames++;
        if (!pill || pill.alpha < 0.5) continue;
        const a = inter(pill, name) / area(name), b = inter(pill, chip) / area(chip);
        const t = fake.callouts.length ? fake.callouts[0].t : null;
        if (a > worstName) { worstName = a; if (a > 0.25 && at == null) at = t; }
        if (b > worstChip) { worstChip = b; if (b > 0.25 && at == null) at = t; }
      }
      out.push({ z, bot: bot.id, sp: sp.name, frames, name: Math.round(worstName * 100), chip: Math.round(worstChip * 100), at });
    }
  }
  return out;
});
await browser.close();
let bad = 0;
for (const r of res) {
  if (!r.frames) { console.log(`FAIL z=${r.z} ${r.bot} ${r.sp}: callout never drawn`); bad++; continue; }
  const fail = r.name > 25 || r.chip > 25; if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} z=${r.z} ${r.bot.padEnd(9)} ${r.sp.padEnd(16)} pill covers name ${r.name}% / HP chip ${r.chip}%${r.at != null ? ` (from t=${r.at.toFixed(2)}s)` : ''}`);
}
console.log(`${res.length} callouts checked, ${bad} cover the caster's nameplate`);
process.exit(bad ? 1 : 0);
