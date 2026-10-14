// M0-05 evidence: render the real client at the bughunt repro (run 3, seed 9306 -> glacierfort,
// teams, easy AI, powerups high) and screenshot Ricochet at the foot of the right ramp.
// Overlay (drawn on a separate canvas, not by the game): red = the stair-step helper rect
// bughunt measured against, cyan = the slope triangle the sim collides with,
// yellow = Ricochet's collision hull, green = the 0.5 circle bughunt uses.
// Usage: python3 -m http.server 8132 & CHROMIUM_PATH=... node docs/alpha/evidence/M0-05/capture.mjs
import { chromium } from 'playwright-core';
const OUT = 'docs/alpha/evidence/M0-05/';
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto((process.env.BASE_URL || 'http://localhost:8132') + '/index.html');
await page.waitForSelector('#btn-quick');
await page.evaluate(async () => {
  const { BOT_IDS } = await import('/src/core/defs.js');
  const { MAP_IDS } = await import('/src/core/maps.js');
  const run = 3, mapIdx = 6;   // same as test/bughunt.mjs: seed 9000 + run*100 + map index
  const players = Array.from({ length: 8 }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(k + run) % BOT_IDS.length], team: k % 2, isAI: true }));
  window.__superbots.startMatch(players, { mode: 'teams', map: MAP_IDS[mapIdx], aiDifficulty: 'easy', powerups: 'high', airStrikes: 'normal' }, 9000 + run * 100 + mapIdx);
});
// Wait for the turn-2 plan phase: Ricochet has settled at the repro spot after turn 1.
for (let i = 0; i < 600; i++) {
  const s = await page.evaluate(() => { const m = window.__superbots.match; return m && { ph: m.phase, t: m.turn }; });
  if (s && s.ph === 'plan' && s.t >= 2) break;
  await page.waitForTimeout(100);
}
const info = await page.evaluate(() => {
  const S = window.__superbots, m = S.match, r = S.renderer;
  m.update = () => {};   // freeze the match (presentation keeps drawing); this page never goes back to play
  const b = m.world.bots.find((x) => x.botId === 'ricochet');
  return { map: m.world.map.id, seed: m.seed, turn: m.turn, phase: m.phase, x: b.x, y: b.y, grounded: b.grounded, facing: b.facing || 1, w: r.w, h: r.h };
});
console.log(JSON.stringify(info));
const { BOT_HULLS } = await import('../../../../src/core/hulls.js');
const overlay = async (on, name) => {
  await page.evaluate(({ on, hullPts }) => {
    const S = window.__superbots, r = S.renderer, m = S.match, b = m.world.bots.find((x) => x.botId === 'ricochet');
    let c = document.getElementById('m005-ov');
    if (!c) { c = document.createElement('canvas'); c.id = 'm005-ov'; c.width = r.w; c.height = r.h; Object.assign(c.style, { position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 99999 }); document.body.appendChild(c); }
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    if (!on) return;
    const T = (x, y) => r.toScreen(x, y);
    const z = r.cam.zoom * r.userZoom;
    const step = m.world.map.terrain.find((rc) => rc.step && Math.abs(rc.x - 35.5) < 0.01 && Math.abs(rc.y - 16.5) < 0.01);
    g.lineWidth = 2;
    g.strokeStyle = '#ff2a2a'; const [sx, sy] = T(step.x, step.y); g.strokeRect(sx, sy, step.w * z, step.h * z);
    const s = m.world.map.slopes.find((q) => q.x === 30);
    g.strokeStyle = '#00e5ff'; g.beginPath(); for (const [px, py] of [[s.x, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]]) g.lineTo(...T(px, py)); g.closePath(); g.stroke();
    const f = (b.facing || 1) < 0 ? -1 : 1;
    g.strokeStyle = '#ffe600'; g.beginPath(); for (const [hx, hy] of hullPts) g.lineTo(...T(b.x + hx * f, b.y + hy)); g.closePath(); g.stroke();
    g.strokeStyle = '#3cff5a'; g.setLineDash([4, 3]); g.beginPath(); g.arc(...T(b.x, b.y), 0.5 * z, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(...T(30, 17)); g.lineTo(...T(40, 17)); g.stroke();   // ground top y=17
  }, { on, hullPts: BOT_HULLS.ricochet });
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + name });
};
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'glacierfort-9306-full.png' });
// Zoom the camera on Ricochet (presentation only).
await page.evaluate(({ x, y }) => { const r = window.__superbots.renderer; r.userZoom = 3; r.cam = { ...r.camTarget }; r.userPan = { x: x - r.cam.x - 2, y: y - r.cam.y - 1 }; r.fitMap = () => {}; r.frameAction = () => {}; r.fitForPlan = () => {}; }, info);
await page.waitForTimeout(800);
await overlay(false, 'glacierfort-9306-ricochet-zoom.png');
await overlay(true, 'glacierfort-9306-ricochet-zoom-overlay.png');
console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
await browser.close();
