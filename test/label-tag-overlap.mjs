// QA-21 (and QA-16) invariant: floating combat labels that belong to a bot (damage, pickup, contact, effect; not the
// map-item powerupCountdown/powerupExpire labels; Renderer.handleEvent -> this.numbers, drawn last by drawNumbers)
// must not sit on top of that bot's own nameplate — its name text or its HP chip — while still readable.
// Drives the real handleEvent for every such event with the bot at the event point, advances each label exactly as Renderer.update does (y -= 0.9/s), and measures the label's text
// box (real measureText at drawNumbers' font) against the name text box and HP chip box computed with drawBots'
// own nameplate formulas, at zoom 22 and 40 px/unit. A label fails when, at any time while its alpha >= 0.5,
// more than 25% of the name box or of the HP chip is covered by it.
// Not a CI gate yet (fails on main until QA-16/QA-21 land).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/label-tag-overlap.mjs

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
  const EVENTS = [
    { type: 'damage', x: 0, y: 0, amount: 25, bot: 0 },
    { type: 'damage', x: 0, y: 0, amount: 0, label: 'blocked', bot: 0 },
    { type: 'pickup', x: 0, y: 0, id: 'frost', name: 'Frost', bot: 0 },
    { type: 'contact', to: 0, kind: 'frost' },
    { type: 'effect', bot: 0, effect: 'frozen' },
  ];
  const ctx = document.createElement('canvas').getContext('2d');
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
    const nf = Math.max(10, Math.round(z * 0.32)); ctx.font = `bold ${nf}px sans-serif`;
    const nw = ctx.measureText(NAME).width, nb = by - z * 0.12;
    const name = { x0: -nw / 2, x1: nw / 2, y0: nb - nf, y1: nb };
    for (const ev of EVENTS) {
      const fake = {
        theme: { floorColor: '#ff5a1f', light: '#fff' }, particles: [], flashes: [], numbers: [], vfx: [], shake: 0, time: 0,
        world: { bots: [{ id: 0, x: 0, y: 0, color: '#fff', name: NAME, def: BOTS.volt, alive: true }] },
        paintedEvent: () => false, playAnim() {}, fx: () => false, emit() {},
      };
      try { Renderer.prototype.handleEvent.call(fake, ev); } catch (err) { out.push({ z, ev: ev.type, error: String(err) }); continue; }
      for (const n0 of fake.numbers) {
        const n = { ...n0 };
        let worstName = 0, worstChip = 0, at = null;
        const dt = 1 / 60;
        for (let t = 0; Math.min(1, (n.life - t) * 2) >= 0.5; t += dt) {
          const f = Math.round(z * (n.big ? 0.62 : 0.42)); ctx.font = `bold ${f}px sans-serif`;
          const w = ctx.measureText(n.text).width, cx = n.x * z, cy = (n.y - t * 0.9) * z;
          const lab = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - f / 2, y1: cy + f / 2 };
          const a = inter(lab, name) / area(name), b = inter(lab, chip) / area(chip);
          if (a > worstName) { worstName = a; if (a > 0.25 && at == null) at = t; }
          if (b > worstChip) { worstChip = b; if (b > 0.25 && at == null) at = t; }
        }
        out.push({ z, ev: ev.type + (ev.label ? ':' + ev.label : ''), text: n.text, name: Math.round(worstName * 100), chip: Math.round(worstChip * 100), at });
      }
    }
  }
  return out;
});
await browser.close();
let bad = 0;
for (const r of res) {
  if (r.error) { console.log(`ERROR z=${r.z} ${r.ev}: ${r.error}`); bad++; continue; }
  const fail = r.name > 25 || r.chip > 25; if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} z=${r.z} ${r.ev.padEnd(17)} "${r.text}" covers name ${r.name}% / HP chip ${r.chip}%${r.at != null ? ` (from t=${r.at.toFixed(2)}s)` : ''}`);
}
console.log(`${res.length} labels checked, ${bad} cover the nameplate`);
process.exit(bad ? 1 : 0);
