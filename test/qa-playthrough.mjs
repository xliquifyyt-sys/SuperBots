// Nightly QA exploratory playthrough: drives 5 full matches through the real lobby UI at 390x844
// and 1280x720 (different maps/bots), screenshots plan/resolve/results, and reports HUD overflow,
// clipped text, sub-11px text, panel overlaps, non-finite or off-map bots and page errors.
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/qa-playthrough.mjs <outDir> [matchIndex]
// Report-only (exit 0): a human or QA agent reads report.json and the screenshots.

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const out = process.argv[2] || join(tmpdir(), 'superbots-qa'); mkdirSync(out, { recursive: true });
const only = process.argv[3] ? Number(process.argv[3]) : null;
const MATCHES = [
  { vp: [390, 844], me: 'volt', ai: ['magmaw'], map: 'emberpit', mode: 'ffa' },
  { vp: [1280, 720], me: 'bulwark', ai: ['phantom', 'skyla'], map: 'frozenkeel', mode: 'ffa' },
  { vp: [390, 844], me: 'ricochet', ai: ['gravitas'], map: 'canopyruins', mode: 'ffa' },
  { vp: [1280, 720], me: 'warden', ai: ['volt', 'magmaw', 'skyla', 'phantom', 'gravitas'], map: 'templecrossing', mode: 'teams' },
  { vp: [390, 844], me: 'skyla', ai: ['ricochet', 'bulwark', 'warden'], map: 'neonalley', mode: 'ffa' },
];
// QA_SET=2 rotates to the other five maps and different bots/viewports (nightly alternates sets).
if (process.env.QA_SET === '2') MATCHES.splice(0, MATCHES.length,
  { vp: [1280, 720], me: 'magmaw', ai: ['ricochet'], map: 'magmaworks', mode: 'ffa' },
  { vp: [390, 844], me: 'phantom', ai: ['warden', 'volt'], map: 'glacierfort', mode: 'ffa' },
  { vp: [1280, 720], me: 'gravitas', ai: ['skyla'], map: 'cloudsteps', mode: 'ffa' },
  { vp: [390, 844], me: 'bulwark', ai: ['magmaw', 'phantom', 'ricochet'], map: 'nimbus', mode: 'teams' },
  { vp: [1280, 720], me: 'volt', ai: ['gravitas', 'warden', 'skyla', 'bulwark'], map: 'skylinegrid', mode: 'ffa' },
);
// QA_SET=3 is an extra exploratory set: map/bot/viewport pairings not covered by sets 1 and 2.
if (process.env.QA_SET === '3') MATCHES.splice(0, MATCHES.length,
  { vp: [1280, 720], me: 'skyla', ai: ['phantom'], map: 'canopyruins', mode: 'ffa' },
  { vp: [390, 844], me: 'gravitas', ai: ['volt', 'warden'], map: 'skylinegrid', mode: 'ffa' },
  { vp: [1280, 720], me: 'ricochet', ai: ['bulwark', 'skyla', 'magmaw'], map: 'glacierfort', mode: 'teams' },
  { vp: [390, 844], me: 'magmaw', ai: ['bulwark'], map: 'cloudsteps', mode: 'ffa' },
  { vp: [1280, 720], me: 'phantom', ai: ['warden', 'gravitas', 'ricochet', 'volt', 'skyla'], map: 'magmaworks', mode: 'ffa' },
);
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const report = [];
for (let mi = 0; mi < MATCHES.length; mi++) {
  if (only != null && only !== mi) continue;
  const M = MATCHES[mi]; const tag = `m${mi + 1}-${M.map}-${M.vp[0]}x${M.vp[1]}`;
  const ctx = await browser.newContext({ viewport: { width: M.vp[0], height: M.vp[1] }, hasTouch: M.vp[0] < 500, isMobile: M.vp[0] < 500 });
  const page = await ctx.newPage();
  const errors = [], issues = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto((process.env.BASE_URL || 'http://localhost:8123') + '/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#btn-quick');
  await page.click('[data-go="menu-lobby"]');
  // Configure via the real UI: pick our bot card, add AI slots and pick their bots, pick the map.
  const S = (sel) => page.locator(sel);
  await page.evaluate(() => { const s = window.__superbots.slots; s.splice(1); });
  await page.click('[data-go="menu-main"]'); await page.click('[data-go="menu-lobby"]');
  const botNames = await page.evaluate(() => [...document.querySelectorAll('#bot-cards .card')].map((c) => c.textContent));
  const meIdx = ['bulwark', 'magmaw', 'volt', 'warden', 'skyla', 'phantom', 'ricochet', 'gravitas'].indexOf(M.me);
  await S('#bot-cards .card').nth(meIdx).click();
  if (M.mode === 'teams') {
    // segmented control button "Teams" in Mode setting
    await page.locator('#settings-grid .setting').first().locator('button', { hasText: 'Teams' }).click();
  }
  // turn cap 20, highest HP so every match ends
  await page.locator('#settings-grid .setting', { hasText: 'Turn cap' }).locator('button', { hasText: '20' }).click();
  await page.locator('#settings-grid .setting', { hasText: 'On turn cap' }).locator('button', { hasText: 'Highest HP' }).click();
  for (let k = 0; k < M.ai.length; k++) {
    await page.click('#btn-add-ai');
    await S('#slots .slot select').nth(k).selectOption(M.ai[k]);
  }
  if (M.mode === 'teams') {
    // make teams: 0..n alternate (default team = index%2) — verify two teams exist
  }
  const mapName = await page.evaluate(async (id) => (await import('/src/core/maps.js')).MAPS[id].name, M.map);
  const mapBtn = page.locator('#map-list button', { hasText: mapName });
  if (await mapBtn.isDisabled()) issues.push(`map ${M.map} disabled for ${M.ai.length + 1} players`);
  await mapBtn.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${tag}-lobby.png`, fullPage: true });
  // lobby layout check: horizontal overflow
  const hov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (hov > 1) issues.push(`lobby horizontal overflow ${hov}px`);
  await page.click('#btn-start');
  const phase = () => page.evaluate(() => window.__superbots.match?.phase ?? null);
  const waitPhase = async (want, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const p = await phase(); if (p === want) return true; if (p === null || p === 'over' || p === 'done') return false; const w = await page.evaluate(() => !!window.__superbots.match?.winner); if (w) return false; await page.waitForTimeout(120); } issues.push(`timeout waiting for ${want} (last ${await phase()})`); return false; };
  let turn = 0; const shots = [];
  const settings = await page.evaluate(() => ({ ...window.__superbots.match.settings, map: window.__superbots.match.world.map.id }));
  if (settings.map !== M.map) issues.push(`started on map ${settings.map}, lobby selected ${M.map}`);
  while (turn < 30 && Date.now() - t0 < 9 * 60 * 1000) {
    if (!(await waitPhase('plan', 40000))) break;
    turn++;
    await page.waitForTimeout(500);
    // HUD checks
    const hud = await page.evaluate(() => {
      const r = []; const W = innerWidth, H = innerHeight;
      for (const el of document.querySelectorAll('#hud *')) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue;
        if (b.right > W + 1 || b.left < -1 || b.bottom > H + 1) r.push(`${el.id || el.className || el.tagName} off-screen [${b.left|0},${b.top|0},${b.right|0},${b.bottom|0}]`);
        if (el.children.length === 0 && el.textContent.trim() && parseFloat(cs.fontSize) < 11) r.push(`${el.id || el.className} font ${cs.fontSize}`);
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflow === 'hidden' && el.textContent.trim()) r.push(`${el.id || el.className} text clipped (${el.scrollWidth}>${el.clientWidth})`);
      }
      const m = window.__superbots.match, w = m.world;
      for (const b of w.bots) {
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) r.push(`bot ${b.name} non-finite pos`);
        if (b.alive && (b.x < 0 || b.x > w.map.width)) r.push(`bot ${b.name} alive outside map x=${b.x}`);
        if (b.alive && b.hp <= 0) r.push(`bot ${b.name} alive with hp ${b.hp}`);
      }
      // overlap: plan-bar vs roster / bot-info
      const rect = (id) => { const e = document.getElementById(id); if (!e || e.classList.contains('hidden') || !e.offsetParent) return null; return e.getBoundingClientRect(); };
      const ov = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const ids = ['plan-bar', 'roster', 'bot-info', 'announce', 'phase-timer'];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const A = rect(ids[i]), B = rect(ids[j]); if (ov(A, B) && document.getElementById(ids[i]).textContent.trim() && document.getElementById(ids[j]).textContent.trim()) r.push(`overlap ${ids[i]} & ${ids[j]}`); }
      // QA-5: the turn label must stay on one line.
      const tl = document.getElementById('turn-label');
      if (tl && tl.getBoundingClientRect().height > parseFloat(getComputedStyle(tl).fontSize) * 1.8) r.push(`turn-label wraps (${tl.textContent})`);
      return r;
    });
    for (const h of hud) issues.push(`T${turn}: ${h}`);
    if (turn === 1 || turn === 5) { const p = `${out}/${tag}-plan-T${turn}.png`; await page.screenshot({ path: p }); shots.push(p); }
    if (!(await page.isVisible('#btn-fire'))) { // spectating
      await page.waitForTimeout(500); continue;
    }
    // choose an action
    const r = rnd();
    const pick = r < 0.15 ? '#act-jump' : r < 0.35 ? '#act-s1' : r < 0.5 ? '#act-s2' : '#act-missile';
    if (await page.isVisible(pick) && await page.isEnabled(pick)) await page.click(pick);
    // aim toward nearest enemy, lobbed
    const aim = await page.evaluate(() => {
      const g = window.__superbots.game, R = window.__superbots.renderer, me = g.me, w = window.__superbots.match.world;
      const foes = w.bots.filter((b) => b.alive && b.team !== me.team);
      foes.sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
      const f = foes[0] || me; const [sx, sy] = R.toScreen(me.x, me.y); const [fx, fy] = R.toScreen(f.x, f.y);
      return { sx, sy, fx, fy, W: innerWidth, H: innerHeight };
    });
    const dir = Math.sign(aim.fx - aim.sx) || 1;
    const cx = aim.W / 2, cy = aim.H * 0.45;
    const len = 60 + rnd() * 120, ang = (25 + rnd() * 40) * Math.PI / 180;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + dir * Math.cos(ang) * len, cy - Math.sin(ang) * len, { steps: 5 }); await page.mouse.up();
    await page.click('#btn-fire');
    if (!(await waitPhase('resolve', 30000))) break;
    await page.waitForTimeout(900);
    if (turn === 2 || turn === 6) { const p = `${out}/${tag}-resolve-T${turn}.png`; await page.screenshot({ path: p }); shots.push(p); }
    if (await page.isVisible('#btn-skip')) await page.click('#btn-skip').catch(() => {});
  }
  // results
  let result = null;
  try {
    await page.waitForSelector('#menu-result:not(.hidden)', { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${tag}-result.png`, fullPage: true });
    result = await page.evaluate(() => document.getElementById('menu-result').innerText.slice(0, 300));
    // QA-4: every results-table cell must be inside the viewport.
    const cut = await page.evaluate(() => [...document.querySelectorAll('#result-table th, #result-table td')].filter((c) => { const b = c.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }).map((c) => c.textContent).slice(0, 6));
    if (cut.length) issues.push(`results table cells off-screen: ${cut.join(' | ')}`);
  } catch { issues.push('no results screen'); await page.screenshot({ path: `${out}/${tag}-final.png` }); }
  const st = await page.evaluate(() => { const m = window.__superbots.match; return m ? { turn: m.turn, winner: m.winner, bots: m.world.bots.map((b) => `${b.name}/${b.botId || b.def?.id}:${Math.round(b.hp)}${b.alive ? '' : 'x'}`) } : null; });
  report.push({ tag, turns: turn, secs: Math.round((Date.now() - t0) / 1000), state: st, result, errors, issues: [...new Set(issues)] });
  console.log(JSON.stringify(report.at(-1)));
  await ctx.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
