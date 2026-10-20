// QA-20 invariant: procedural effect particles (Renderer.handleEvent fallbacks, drawn after the bots)
// must not hide a bot standing in them. Drives the real handleEvent + emit with each area event centred
// on a bot, steps the particles with the same integration as Renderer.update, and rasterises the bot's
// 1x1-unit box against the particle squares exactly as drawParticles sizes and fades them. A sample
// point counts as hidden when the stacked particle alpha there is >= 0.85. Fails if, at any sampled
// time from 0.3 s on (a 0.1 s burst is fine), more than 50% of the bot box is hidden (averaged over 20 trials, Math.random-driven like the game).
// Not a CI gate yet (fails on main until QA-20 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/fx-occlusion.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async () => {
  const { BOTS } = await import('/src/core/defs.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const EVENTS = [
    { type: 'toxic', x: 0, y: 0, r: BOTS.phantom.s2.radius },
    { type: 'geyser', x: 0, y: 0.5, r: 1.5 },
    { type: 'mine', x: 0, y: 0 },
    { type: 'blink', from: [0, 0], to: [0, 0], color: '#c070ff' },
    { type: 'teleport', from: [0, 0], to: [0, 0] },
    { type: 'wallBreak', x: 0, y: 0 },
    { type: 'lavaSurf', x: 0, y: 0.5 },
  ];
  const TIMES = [0.1, 0.3, 0.6, 1.0, 1.5];
  const out = [];
  for (const ev of EVENTS) {
    const worst = new Array(TIMES.length).fill(0);
    for (let trial = 0; trial < 20; trial++) {
      const fake = {
        theme: { floorColor: '#ff5a1f', light: '#fff' }, particles: [], flashes: [], numbers: [], shake: 0, time: 0,
        world: { bots: [{ x: 0, y: 0, color: '#fff', name: 'Bot', def: BOTS.volt }] },
        paintedEvent: () => false, playAnim() {}, fx: () => false,
        emit: Renderer.prototype.emit,
      };
      try { Renderer.prototype.handleEvent.call(fake, ev); } catch (err) { out.push({ type: ev.type, error: String(err) }); break; }
      let t = 0; const dt = 1 / 60;
      TIMES.forEach((T, ti) => {
        while (t < T - 1e-9) { for (const p of fake.particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; } fake.particles = fake.particles.filter((p) => p.t < p.life); t += dt; }
        let hidden = 0, n = 0;
        for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
          const sx = -0.5 + (i + 0.5) / 20, sy = -0.5 + (j + 0.5) / 20; let clear = 1;
          for (const p of fake.particles) {
            const hw = p.size / 2, hh = p.chunk ? p.size / 3 : p.size / 2;
            if (Math.abs(sx - p.x) <= hw && Math.abs(sy - p.y) <= hh) clear *= 1 - Math.max(0, 1 - p.t / p.life);
          }
          n++; if (1 - clear >= 0.85) hidden++;
        }
        worst[ti] += hidden / n / 20;
      });
    }
    out.push({ type: ev.type, hidden: worst.map((v) => Math.round(v * 100)) });
  }
  return { out, TIMES };
});
await browser.close();
let bad = 0;
for (const r of res.out) {
  if (r.error) { console.log(`ERROR ${r.type}: ${r.error}`); bad++; continue; }
  const peak = Math.max(...r.hidden.filter((_, i) => res.TIMES[i] >= 0.3));
  const fail = peak > 50; if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} ${r.type.padEnd(10)} bot box hidden at t=${res.TIMES.join('/')}s: ${r.hidden.join('/')}%`);
}
console.log(`${res.out.length} effects checked, ${bad} hide the bot`);
process.exit(bad ? 1 : 0);
