// QA-29 invariant: two floating labels that one sim tick spawns on the same bot (Renderer.handleEvent -> this.numbers)
// must not print on top of each other. Sim.transferContact emits 'effect' (POISON / FROZEN / SHOCKED) and then
// 'contact' (TOXIN! / FROST! / SHOCKWIRE!) for the same bot in the same tick; a burning or shocking hit emits 'damage'
// and 'effect' together. Drives the real handleEvent for each pair into one renderer, advances both labels exactly as
// Renderer.update does (y -= 0.9/s), and measures their text boxes (real measureText at drawNumbers' font) at zoom 22
// and 40 px/unit. A pair fails when, at any time while both are readable (alpha >= 0.5), their boxes overlap by more
// than 25% of the smaller box.
// Not a CI gate yet (fails on main until QA-29 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/label-stack.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async () => {
  const { BOTS } = await import('/src/core/defs.js');
  const { Renderer } = await import('/src/render/renderer.js');
  // Event order matches the sim: addEffect() emits 'effect' before transferContact() emits 'contact'.
  const PAIRS = [
    ['toxin contact', { type: 'effect', bot: 0, effect: 'poison' }, { type: 'contact', from: 1, to: 0, kind: 'toxin' }],
    ['frost contact', { type: 'effect', bot: 0, effect: 'frozen' }, { type: 'contact', from: 1, to: 0, kind: 'frost' }],
    ['shockwire contact', { type: 'effect', bot: 0, effect: 'shocked' }, { type: 'contact', from: 1, to: 0, kind: 'shockwire' }],
    ['burning hit', { type: 'damage', x: 0, y: 0, amount: 15, bot: 0 }, { type: 'effect', bot: 0, effect: 'burn' }],
    ['shocking hit', { type: 'damage', x: 0, y: 0, amount: 20, bot: 0 }, { type: 'effect', bot: 0, effect: 'shocked' }],
    // Sim.applyPowerup: the pickup label and the effect label of amp/plating/thrusters/reflector land on one tick too.
    ['amp pickup', { type: 'pickup', x: 0, y: 0, id: 'amp', name: 'Amp', bot: 0 }, { type: 'effect', bot: 0, effect: 'amp' }],
  ];
  const ctx = document.createElement('canvas').getContext('2d');
  const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (a) => (a.x1 - a.x0) * (a.y1 - a.y0);
  const out = [];
  for (const z of [22, 40]) {
    for (const [label, ...evs] of PAIRS) {
      const fake = {
        theme: { floorColor: '#ff5a1f', light: '#fff' }, particles: [], flashes: [], numbers: [], vfx: [], shake: 0, time: 0,
        world: { bots: [0, 1].map((id) => ({ id, x: 0, y: 0, color: '#fff', name: 'Mira', def: BOTS.volt, alive: true })) },
        paintedEvent: () => false, playAnim() {}, fx: () => false, emit() {},
      };
      try { for (const ev of evs) Renderer.prototype.handleEvent.call(fake, ev); } catch (err) { out.push({ z, label, error: String(err) }); continue; }
      if (fake.numbers.length < 2) { out.push({ z, label, error: `expected 2 labels, got ${fake.numbers.length}` }); continue; }
      const [a, b] = fake.numbers;
      const box = (n, t) => {
        const f = Math.round(z * (n.big ? 0.62 : 0.42)); ctx.font = `bold ${f}px sans-serif`;
        const w = ctx.measureText(n.text).width, cx = n.x * z, cy = (n.y - t * 0.9) * z;
        return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - f / 2, y1: cy + f / 2 };
      };
      let worst = 0, at = null;
      for (let t = 0; Math.min(1, (a.life - t) * 2) >= 0.5 && Math.min(1, (b.life - t) * 2) >= 0.5; t += 1 / 60) {
        const A = box(a, t), B = box(b, t);
        const o = inter(A, B) / Math.min(area(A), area(B));
        if (o > worst) worst = o;
        if (o > 0.25 && at == null) at = t;
      }
      out.push({ z, label, texts: `"${a.text}" + "${b.text}"`, overlap: Math.round(worst * 100), at });
    }
  }
  return out;
});
await browser.close();
let bad = 0;
for (const r of res) {
  if (r.error) { console.log(`ERROR z=${r.z} ${r.label}: ${r.error}`); bad++; continue; }
  const fail = r.overlap > 25; if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} z=${r.z} ${r.label.padEnd(18)} ${r.texts.padEnd(26)} overlap ${r.overlap}%${r.at != null ? ` (from t=${r.at.toFixed(2)}s)` : ''}`);
}
console.log(`${res.length} same-tick label pairs checked, ${bad} print on top of each other`);
process.exit(bad ? 1 : 0);
