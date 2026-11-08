// QA-34 invariant: during playback (resolve phase) the camera target from the real Renderer.frameAction must keep every
// living bot's body on screen. Steps AI-only matches tick by tick in the browser, and on every 6th tick snaps a fake
// Renderer (real prototype) to frameAction(alive bots + projectiles), exactly what src/ui/game.js does each frame, then
// (labelled by the map the match actually used: 5+ players are moved to a battle map) checks each living bot above the kill floor is inside the viewport (body centre with a 0.5-unit margin, HUD top band
// of 60px counted as off screen). Report: worst cases per map/viewport. Not a CI gate (fails on main until QA-34 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/playback-framing.mjs [matchesPerMap=2]

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const per = Number(process.argv[2] || 2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async (per) => {
  const { PHYS, BOT_IDS } = await import('/src/core/defs.js');
  const { MAP_IDS } = await import('/src/core/maps.js');
  const { Match } = await import('/src/core/match.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const out = []; let frames = 0;
  for (const mapId of MAP_IDS) {
    for (let k = 0; k < per; k++) {
      const n = 2 + ((k * 3 + mapId.length) % 5);
      const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, botId: BOT_IDS[(k * 5 + i * 3 + mapId.length) % BOT_IDS.length], team: i % 2, isAI: true }));
      const m = new Match(players, { mode: 'ffa', map: mapId, aiDifficulty: 'normal' }, 4200 + k * 17 + mapId.length);
      m.start();
      let guard = 0;
      while (m.phase !== 'over' && guard++ < 400) {
        if (m.phase === 'announce') m.beginPlan();
        else if (m.phase === 'plan') m.beginResolve();
        else if (m.phase === 'cleanup') m.beginAnnounce();
        else if (m.phase === 'resolve') {
          const w = m.world; let tick = 0, done = false;
          while (!done) {
            done = w.step(PHYS.dt);
            if (tick++ % 6) continue;
            const pts = [];
            for (const b of w.bots) if (b.alive) pts.push([b.x, b.y]);
            for (const p of w.projectiles) pts.push([p.x, p.y]);
            for (const [W, H] of [[390, 844], [1280, 720], [844, 390]]) {
              const fake = { w: W, h: H, world: w, userZoom: 1, userPan: { x: 0, y: 0 } };
              Object.setPrototypeOf(fake, Renderer.prototype);
              fake.frameAction(pts); fake.cam = { ...fake.camTarget }; frames++;
              const z = fake.cam.zoom, r = PHYS.botRadius * z + 0.5 * z;
              for (const b of w.bots) {
                if (!b.alive || b.y > w.lavaY) continue;
                const [x, y] = fake.toScreen(b.x, b.y);
                const off = Math.max(0, r - x, x + r - W, 60 + r - y, y + r - H);
                if (off > 0) out.push({ vp: `${W}x${H}`, map: m.map.id, seed: 4200 + k * 17 + mapId.length, turn: m.turn, bot: b.botId, bx: +b.x.toFixed(1), by: +b.y.toFixed(1), sx: Math.round(x), sy: Math.round(y), off: Math.round(off), projectiles: w.projectiles.length });
              }
            }
          }
          m.beginCleanup();
        }
      }
    }
  }
  return { out, frames };
}, per);
await browser.close();
const worst = new Map();
for (const r of res.out) { const k = `${r.vp} ${r.map}`; if (!worst.has(k) || worst.get(k).off < r.off) worst.set(k, { ...r, n: (worst.get(k)?.n || 0) + 1 }); else worst.get(k).n++; }
for (const [k, r] of [...worst].sort()) console.log(`FAIL ${k.padEnd(26)} ${String(r.n).padStart(4)} bot-frames off screen; worst: ${r.bot} at (${r.bx},${r.by}) drawn at ${r.sx},${r.sy} (${r.off}px out) seed ${r.seed} T${r.turn}, ${r.projectiles} projectiles in flight`);
console.log(`${res.out.length} bot-frames off screen in ${res.frames} sampled camera frames`);
process.exit(res.out.length ? 1 : 0);
