const PW = process.env.PW_MODULE || 'playwright-core';
const { chromium } = await import(PW);
const MAPS = ['emberpit','magmaworks','frozenkeel','glacierfort','canopyruins','templecrossing','cloudsteps','nimbus','neonalley','skylinegrid'];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1200, height: 560 } });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:8123/index.html');
await pg.waitForFunction(() => window.__superbots);
await pg.addStyleTag({ content: '#hud,#ui,#plan-bar,#roster,.hud-top,#playback-bar{display:none!important}' });
for (const m of MAPS) {
  await pg.evaluate((map) => {
    const sb = window.__superbots;
    sb.startMatch([{name:'a',botId:'volt',team:0,isAI:true},{name:'b',botId:'volt',team:1,isAI:true}], { ...sb.settings, mode:'ffa', map }, 1);
    setTimeout(() => { for (const bot of sb.match.world.bots) { bot.x = -500; bot.y = -500; } sb.renderer.fitMap(true); }, 60);
  }, m);
  await pg.waitForTimeout(1100);
  await pg.evaluate(() => {
    const sb = window.__superbots, r = sb.renderer, map = sb.match.world.map;
    r.fitMap(true);
    document.getElementById('gridoverlay')?.remove();
    const cv = document.createElement('canvas');
    cv.id = 'gridoverlay';
    cv.width = innerWidth; cv.height = innerHeight;
    Object.assign(cv.style, { position:'fixed', inset:'0', zIndex:'9999', pointerEvents:'none' });
    document.body.appendChild(cv);
    const c = cv.getContext('2d');
    c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const step = 2;
    for (let x = 0; x <= map.width; x += step) {
      const [sx, sy0] = r.toScreen(x, 0), [, sy1] = r.toScreen(x, map.height);
      c.strokeStyle = x % 10 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)';
      c.lineWidth = x % 10 === 0 ? 1.5 : 1;
      c.beginPath(); c.moveTo(sx, sy0); c.lineTo(sx, sy1); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.strokeText(String(x), sx, sy0 + 10); c.fillText(String(x), sx, sy0 + 10);
    }
    for (let y = 0; y <= map.height; y += step) {
      const [sx0, sy] = r.toScreen(0, y), [sx1] = r.toScreen(map.width, y);
      c.strokeStyle = y % 10 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)';
      c.lineWidth = y % 10 === 0 ? 1.5 : 1;
      c.beginPath(); c.moveTo(sx0, sy); c.lineTo(sx1, sy); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.strokeText(String(y), sx0 + 12, sy); c.fillText(String(y), sx0 + 12, sy);
    }
  });
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${new URL('../art/reference/maps/grid/', import.meta.url).pathname}${m}-grid.png` });
}
await b.close(); console.log('grid renders done');
