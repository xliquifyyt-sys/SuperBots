// Browser smoke test: menu, lobby, quick 1v1 with drag-aim and specials, 8-player teams match.
// Usage: npm i --no-save playwright-core && python3 -m http.server 8123 & node test/browser.mjs
// Set CHROMIUM_PATH to use a specific Chromium binary.

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto((process.env.BASE_URL || 'http://localhost:8123') + '/index.html');
await page.waitForSelector('#btn-quick');
await page.screenshot({ path: 'test/shot-menu.png' });
await page.click('[data-go="menu-lobby"]');
await page.waitForTimeout(300);
await page.screenshot({ path: 'test/shot-lobby.png', fullPage: true });
await page.click('[data-go="menu-main"]');
await page.click('#btn-quick');
// wait for plan phase
const waitPhase = async (ph, ms=20000) => { const t0=Date.now(); while (Date.now()-t0<ms) { const p = await page.evaluate(() => window.__superbots.match?.phase); if (p===ph) return true; await page.waitForTimeout(100);} throw new Error('phase '+ph+' not reached'); };
await waitPhase('plan');
await page.waitForTimeout(400);
await page.screenshot({ path: 'test/shot-plan.png' });
// drag to aim: from center toward upper-right
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(760, 300, { steps: 8 }); await page.waitForTimeout(150);
await page.screenshot({ path: 'test/shot-aim.png' });
await page.mouse.up();
console.log('readout:', await page.textContent('#aim-readout'));
await page.click('#btn-fire');
await waitPhase('resolve');
await page.waitForTimeout(700);
await page.screenshot({ path: 'test/shot-resolve.png' });
await waitPhase('plan', 30000);
// choose special 1 and aim
await page.click('#act-s1');
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(520, 320, { steps: 6 }); await page.mouse.up();
await page.screenshot({ path: 'test/shot-special.png' });
await page.click('#btn-fire');
await waitPhase('resolve');
await page.click('#btn-skip');
await waitPhase('plan', 30000);
const st = await page.evaluate(() => { const m = window.__superbots.match; return { turn: m.turn, bots: m.world.bots.map(b => ({ n: b.name, hp: b.hp, alive: b.alive })) }; });
console.log('state', JSON.stringify(st));
// Pause & quit
await page.click('#btn-pause'); await page.waitForTimeout(200);
await page.click('#btn-quit'); await page.waitForTimeout(200);
// Custom 8 player teams game on a battle map
await page.click('[data-go="menu-lobby"]');
await page.click('#btn-fill');
await page.evaluate(() => { const s = window.__superbots.settings; s.mode = 'teams'; s.map = 'nimbus'; });
await page.click('[data-go="menu-main"]'); await page.click('[data-go="menu-lobby"]'); // re-render lobby with new settings
await page.screenshot({ path: 'test/shot-lobby8.png', fullPage: true });
await page.click('#btn-start');
await waitPhase('plan');
await page.waitForTimeout(300);
await page.screenshot({ path: 'test/shot-8p.png' });
// play several turns quickly via skip and auto aim
for (let i = 0; i < 6; i++) {
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(700 - i*40, 300, { steps: 4 }); await page.mouse.up();
  await page.click('#btn-fire');
  await waitPhase('resolve', 30000);
  await page.waitForTimeout(300);
  if (i === 2) await page.screenshot({ path: 'test/shot-8p-resolve.png' });
  await page.click('#btn-skip');
  const ph = await page.evaluate(() => window.__superbots.match?.phase);
  if (!ph) break;
  try { await waitPhase('plan', 15000); } catch { break; }
}
const st2 = await page.evaluate(() => { const m = window.__superbots.match; return m ? { turn: m.turn, phase: m.phase, alive: m.world.bots.filter(b=>b.alive).length } : 'over'; });
console.log('8p state', JSON.stringify(st2));
console.log('ERRORS', errors.length ? errors : 'none');
await browser.close();
