import { chromium } from '/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad/dl/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:8123/index.html');
await pg.waitForFunction(() => window.__superbots);
await pg.waitForTimeout(1200);   // let painted sprites load
const ids = await pg.evaluate(async () => {
  const { BOTS, BOT_IDS, PHYS } = await import('/src/core/defs.js');
  const { drawBot } = await import('/src/render/bots.js');
  const hulls = await import('/src/core/hulls.js');
  document.body.innerHTML = '<canvas id="hb" width="520" height="520" style="display:block"></canvas>';
  document.body.style.margin = '0';
  window.__hb = { BOTS, BOT_IDS, PHYS, drawBot, hulls };
  return BOT_IDS;
});
for (const id of ids) {
  await pg.evaluate((id) => {
    const { BOTS, PHYS, drawBot } = window.__hb;
    const def = BOTS[id];
    const c = document.getElementById('hb').getContext('2d');
    const W = 520, H = 520, PX = 150;                 // 150 screen px per world unit
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#101620'; c.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    // world grid, one line per half unit
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    for (let u = -2; u <= 2; u += 0.5) {
      const p = Math.round(cx + u * PX) + 0.5;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, H); c.stroke();
      const q = Math.round(cy + u * PX) + 0.5;
      c.beginPath(); c.moveTo(0, q); c.lineTo(W, q); c.stroke();
    }
    // ground line at the bottom of the collision body
    const groundY = cy + Math.max(...window.__hb.hulls.BOT_HULLS[id].map(p => p[1])) * PX;
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.setLineDash([6, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, groundY); c.lineTo(W, groundY); c.stroke(); c.setLineDash([]);
    // the sprite, exactly as the game draws it
    const r = PHYS.botRadius * PX;
    c.save(); c.translate(cx, cy);
    drawBot(c, def, r * 1.67 * PHYS.botVisualScale, { anim: 'idle', t: 0, facing: 1, grounded: true, vx: 0, vy: 0, color: def.color, hp: 1, id: 0 }, 0.6);
    c.restore();
    // the one body outline: what terrain pushes against AND what a shot has to reach
    const { BOT_HULLS } = window.__hb.hulls;
    const HULL = BOT_HULLS[id];
    c.beginPath(); HULL.forEach(([hx, hy], i) => { const px = cx + hx * PX, py = cy + hy * PX; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }); c.closePath();
    c.fillStyle = 'rgba(63,233,255,0.10)'; c.fill();
    c.strokeStyle = '#3fe9ff'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#3fe9ff'; for (const [hx, hy] of HULL) { c.beginPath(); c.arc(cx + hx * PX, cy + hy * PX, 4, 0, Math.PI * 2); c.fill(); }
    // centre cross
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx - 9, cy); c.lineTo(cx + 9, cy); c.moveTo(cx, cy - 9); c.lineTo(cx, cy + 9); c.stroke();
  }, id);
  await pg.screenshot({ path: '/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad/hb/' + id + '.png', clip: { x: 0, y: 0, width: 520, height: 520 } });
}
await b.close(); console.log('rendered', ids.length);
