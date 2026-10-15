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
const waitPhase = async (ph, ms=20000) => { const t0=Date.now(); while (Date.now()-t0<ms) { const p = await page.evaluate(() => window.__superbots.match?.phase); if (p===ph) return true; if (p == null && Date.now()-t0 > 1500) return false; /* match finished */ await page.waitForTimeout(100);} const last = await page.evaluate(() => { const m = window.__superbots.match; return m ? m.phase + ' turn ' + m.turn + ' winner ' + JSON.stringify(m.winner) : 'no match'; }); throw new Error('phase '+ph+' not reached; last state: '+last); };
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
// A quick 1v1 against a random bot on a random map can legitimately end on turn 1.
let alive1v1 = await waitPhase('plan', 30000);
if (alive1v1) {
// choose special 1 and aim (it can be legitimately disabled: Sudden Death, EMP, status effects)
if (await page.isEnabled('#act-s1')) await page.click('#act-s1'); else console.log('special 1 unavailable this turn');
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(520, 320, { steps: 6 }); await page.mouse.up();
await page.screenshot({ path: 'test/shot-special.png' });
await page.click('#btn-fire');
await waitPhase('resolve');
await page.click('#btn-skip');
alive1v1 = await waitPhase('plan', 30000);
}
if (alive1v1) {
const st = await page.evaluate(() => { const m = window.__superbots.match; return { turn: m.turn, bots: m.world.bots.map(b => ({ n: b.name, hp: b.hp, alive: b.alive })) }; });
console.log('state', JSON.stringify(st));
// Pause & quit
await page.click('#btn-pause'); await page.waitForTimeout(200);
await page.click('#btn-quit'); await page.waitForTimeout(200);
} else {
console.log('quick 1v1 finished early; continuing from the results screen');
await page.waitForSelector('#menu-result:not(.hidden)', { timeout: 15000 });
await page.screenshot({ path: 'test/shot-result.png' });
await page.click('#menu-result [data-go="menu-main"]'); await page.waitForTimeout(200);
}
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
  // The human bot can be eliminated in an 8-bot match; FIRE is hidden while spectating.
  if (!(await page.isVisible('#btn-fire'))) { console.log('human eliminated at loop', i); break; }
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
// Uncaught exceptions fail the gate. Console noise (e.g. a missing optional asset) is reported only.
if (errors.some((e) => e.startsWith('pageerror'))) process.exit(1);
// M0-01: any 404 on load or during play fails the gate, and Botpedia must show painted portraits.
const notFound = errors.filter((e) => /\b404\b/.test(e));
if (notFound.length) { console.error('FAIL console 404s:', notFound); process.exit(1); }
{
  const b2 = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  const missing = [];
  for (const [w, h] of [[390, 844], [844, 390], [1280, 720]]) {
    const p2 = await b2.newPage({ viewport: { width: w, height: h } });
    p2.on('response', (r) => { if (r.status() === 404) missing.push(r.url()); });
    p2.on('console', (m) => { if (m.type() === 'error' && /\b404\b/.test(m.text())) missing.push(m.text()); });
    await p2.goto((process.env.BASE_URL || 'http://localhost:8123') + '/index.html');
    await p2.waitForSelector('#btn-quick');
    await p2.click('[data-go="menu-botpedia"]');
    const expected = await p2.evaluate(() => document.querySelectorAll('#botpedia .card').length);
    if (expected < 8) { console.error('FAIL botpedia shows', expected, 'cards'); process.exit(1); }
    try {
      await p2.waitForFunction((n) => document.querySelectorAll('#botpedia canvas.portrait[data-painted="1"]').length === n, expected, { timeout: 10000 });
    } catch {
      const st = await p2.evaluate(() => [...document.querySelectorAll('#botpedia canvas.portrait')].map((c) => c.dataset.bot + '=' + c.dataset.painted));
      console.error('FAIL botpedia portraits not painted at', w + 'x' + h, st); process.exit(1);
    }
    await p2.waitForTimeout(200);
    await p2.screenshot({ path: `test/shot-botpedia-${w}x${h}.png`, fullPage: true });
    console.log('botpedia painted portraits', w + 'x' + h, expected);
    await p2.close();
  }
  await b2.close();
  if (missing.length) { console.error('FAIL 404s on load:', missing); process.exit(1); }
}
// M0-11: Botpedia and lobby card text is never below 12px at phone width, and cards do not overflow.
{
  const b3 = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  const bad = [];
  for (const [w, h] of [[390, 844], [1280, 720]]) {
    const p3 = await b3.newPage({ viewport: { width: w, height: h } });
    for (const [go, sel] of [['menu-botpedia', '#botpedia'], ['menu-lobby', '#bot-cards']]) {
      await p3.goto((process.env.BASE_URL || 'http://localhost:8123') + '/index.html');
      await p3.waitForSelector('#btn-quick');
      await p3.click(`[data-go="${go}"]`);
      await p3.waitForTimeout(300);
      const r = await p3.evaluate((sel) => {
        const out = { cards: 0, min: Infinity, small: [], overflow: [] };
        for (const card of document.querySelectorAll(sel + ' .card')) {
          out.cards++;
          const cr = card.getBoundingClientRect();
          if (card.scrollWidth > card.clientWidth + 1) out.overflow.push(card.dataset.bot);
          for (const el of card.querySelectorAll('*')) {
            if (!el.getClientRects().length) continue;
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const fs = parseFloat(getComputedStyle(el).fontSize);
            out.min = Math.min(out.min, fs);
            if (fs < 12) out.small.push(card.dataset.bot + ' .' + (el.className || el.tagName) + ' ' + fs + 'px');
            const er = el.getBoundingClientRect();
            if (er.width && (er.right > cr.right + 0.5 || er.left < cr.left - 0.5)) out.overflow.push(card.dataset.bot + ' .' + (el.className || el.tagName));
          }
        }
        return out;
      }, sel);
      if (r.cards < 8) bad.push(`${sel} at ${w}x${h} shows ${r.cards} cards`);
      if (r.small.length) bad.push(`${sel} at ${w}x${h} text below 12px: ${r.small.join(', ')}`);
      if (r.overflow.length) bad.push(`${sel} at ${w}x${h} overflow: ${r.overflow.join(', ')}`);
      await p3.screenshot({ path: `test/shot-cards-${sel.slice(1)}-${w}x${h}.png`, fullPage: true });
      console.log('card text min', sel, w + 'x' + h, r.min + 'px', r.cards, 'cards');
    }
    await p3.close();
  }
  await b3.close();
  if (bad.length) { console.error('FAIL card text/overflow:', bad); process.exit(1); }
}
