// QA-22 invariant: in the plan phase every bot's nameplate (dark capsule with HP chip and bar, drawBots geometry)
// must be fully inside the viewport. Uses the real Renderer.fitForPlan/fitMap/toScreen (camera snapped to its target)
// for "me" standing on every spawn pad of every map (and 1 unit from either side), at 390x844 (portrait) and 1280x720, and checks the nameplate of
// a bot on each spawn pad whose body centre is on screen.
// Not a CI gate yet (fails on main until QA-22 lands).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/nameplate-edge.mjs

import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://localhost:8123';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base + '/index.html');
await page.waitForSelector('#btn-quick');
const res = await page.evaluate(async () => {
  const { PHYS } = await import('/src/core/defs.js');
  const { MAPS } = await import('/src/core/maps.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const out = [];
  for (const [W, H] of [[390, 844], [1280, 720]]) {
    for (const map of Object.values(MAPS)) {
      // every pad, plus "me" standing 1 unit from each side of the map (a bot pushed against the edge wall)
      const mes = [...map.spawns, [1, map.spawns[0][1]], [map.width - 1, map.spawns[0][1]]];
      for (const me of mes) {
        const fake = { w: W, h: H, world: { map, lavaY: map.killFloor.y }, userZoom: 1, userPan: { x: 0, y: 0 } };
        Object.setPrototypeOf(fake, Renderer.prototype);
        fake.fitForPlan(me[0], me[1]);
        fake.cam = { ...fake.camTarget };
        const z = fake.cam.zoom;
        for (const s of [...map.spawns, ...(map.spawns.includes(me) ? [] : [me])]) {
          const [x, y] = fake.toScreen(s[0], s[1]);
          if (x < 0 || x > W) continue; // body off screen: QA-6's concern, not this test's
          const r = PHYS.botRadius * z;
          const bw = Math.max(40, r * 3.1), bh = Math.max(6, z * 0.2), chipW = Math.max(16, z * 0.62);
          const capX = x - bw / 2 - chipW * 0.55, capW = bw + chipW * 0.7;
          const x0 = capX - 2, x1 = capX + capW + 2;
          const by = y - r * 1.75 - z * 0.5;
          if (x0 < 0 || x1 > W || by - bh < 0) out.push({ vp: `${W}x${H}`, map: map.id, me: me.join(','), bot: s.join(','), x0: Math.round(x0), x1: Math.round(x1), self: s === me });
        }
      }
    }
  }
  return out;
});
await browser.close();
const seen = new Set();
for (const r of res) {
  const k = `${r.vp} ${r.map} ${r.bot}${r.self ? " me" : ""}`; if (seen.has(k)) continue; seen.add(k);
  console.log(`FAIL ${r.vp} ${r.map.padEnd(15)} bot on pad (${r.bot})${r.self ? ' = me' : ''}: nameplate x ${r.x0}..${r.x1} leaves the screen`);
}
console.log(`${seen.size} pad/viewport nameplates clipped (${res.length} camera/bot cases)`);
process.exit(res.length ? 1 : 0);
