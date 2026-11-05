// QA exploratory: finish a Quick 1v1 through the real UI, then REMATCH from the results screen and finish
// that too. Checks the rematch is a fresh match (TURN 1, new match object, same roster/map/bots, full HP,
// fresh-match stats), the results screen is rebuilt for the second match, the main-menu RECORD counts exactly
// one game per finished match, and quitting a match mid-way leaves the record unchanged. Both viewports.
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/rematch-record.mjs [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const out = process.argv[2]; if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
let fails = 0; const fail = (m) => { fails++; console.log('FAIL ' + m); }; const ok = (m) => console.log('ok   ' + m);
for (const vp of [[390, 844], [1280, 720]]) {
  const tag = `${vp[0]}x${vp[1]}`;
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: vp[0] < 500, isMobile: vp[0] < 500 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto((process.env.BASE_URL || 'http://localhost:8123') + '/index.html');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#btn-quick');
  const phase = () => page.evaluate(() => window.__superbots.match?.phase ?? null);
  const record = () => page.evaluate(() => JSON.parse(localStorage.getItem('superbots.record') || '{"games":0,"wins":0,"losses":0}'));
  const fire = async () => { await page.mouse.move(vp[0] / 2, vp[1] * 0.45); await page.mouse.down(); await page.mouse.move(vp[0] / 2 - 90, vp[1] * 0.45 + 70, { steps: 5 }); await page.mouse.up(); await page.click('#btn-fire', { timeout: 3000 }).catch(() => {}); };
  // 2x speed + skip keep a full match around a minute
  const playOut = async (ms = 240000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (await page.isVisible('#menu-result')) return true;
      const p = await phase();
      if (p === 'plan') { await fire(); await page.waitForTimeout(300); }
      else { if (await page.isVisible('#btn-skip').catch(() => false)) await page.click('#btn-skip', { timeout: 1000 }).catch(() => {}); await page.waitForTimeout(250); }
    }
    return false;
  };
  const snap = () => page.evaluate(() => { const m = window.__superbots.match; return m && { map: m.map.id, turn: m.world.turn, label: document.getElementById('turn-label')?.textContent, roster: document.querySelectorAll('#roster > *').length, bots: m.world.bots.map((b) => ({ name: b.name, bot: b.def.id, hp: b.hp, max: b.maxHp ?? b.def.hp, alive: b.alive, stats: { ...b.stats } })) }; });

  await page.click('#btn-quick');
  await page.waitForFunction(() => window.__superbots.match?.phase === 'plan', null, { timeout: 30000 });
  const first = await snap();
  await page.evaluate(() => { window.__m1 = window.__superbots.match; });
  if (!(await playOut())) { fail(`${tag}: first Quick 1v1 never reached the results screen`); await ctx.close(); continue; }
  const sub1 = await page.textContent('#result-sub');
  if (out) await page.screenshot({ path: `${out}/rematch-result1-${tag}.png` });
  let r = await record();
  if (r.games !== 1 || r.wins + r.losses !== 1) fail(`${tag}: record after 1 match = ${JSON.stringify(r)}`); else ok(`${tag}: record after match 1 ${JSON.stringify(r)}`);

  await page.click('#btn-rematch');
  await page.waitForFunction(() => window.__superbots.match?.phase === 'plan', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  const re = await snap();
  if (!re) { fail(`${tag}: REMATCH did not start a match`); await ctx.close(); continue; }
  if (await page.evaluate(() => window.__superbots.match === window.__m1)) fail(`${tag}: REMATCH reuses the finished match object`);
  if (!/TURN 1\b/.test(re.label || '')) fail(`${tag}: rematch turn label "${re.label}" (want TURN 1)`);
  if (re.map !== first.map) fail(`${tag}: rematch map ${re.map}, first match ${first.map}`);
  const names = (s) => s.bots.map((b) => `${b.name}/${b.bot}`).join(',');
  if (names(re) !== names(first)) fail(`${tag}: rematch roster ${names(re)} vs first ${names(first)}`);
  if (re.roster !== re.bots.length) fail(`${tag}: rematch HUD roster ${re.roster} rows for ${re.bots.length} bots`);
  for (const b of re.bots) {
    if (!b.alive || b.hp !== first.bots.find((x) => x.name === b.name)?.hp) fail(`${tag}: rematch ${b.name} starts at ${b.hp} HP alive=${b.alive}`);
    const f = first.bots.find((x) => x.name === b.name)?.stats || {};
    if (JSON.stringify(b.stats) !== JSON.stringify(f)) fail(`${tag}: rematch ${b.name} starts with stats ${JSON.stringify(b.stats)} (fresh match: ${JSON.stringify(f)})`);
  }
  ok(`${tag}: rematch ${re.map} ${names(re)} "${re.label}"`);
  if (!(await playOut())) fail(`${tag}: rematch never reached the results screen`);
  else {
    const sub2 = await page.textContent('#result-sub');
    const rows = await page.$$eval('#result-table tr', (t) => t.length - 1);
    if (rows !== re.bots.length) fail(`${tag}: rematch results table has ${rows} rows for ${re.bots.length} bots`);
    if (out) await page.screenshot({ path: `${out}/rematch-result2-${tag}.png` });
    r = await record();
    if (r.games !== 2 || r.wins + r.losses !== 2) fail(`${tag}: record after 2 matches = ${JSON.stringify(r)}`); else ok(`${tag}: record after rematch ${JSON.stringify(r)} ("${sub1}" then "${sub2}")`);
  }
  // quit mid-match: record must not change; main menu shows the stored record
  await page.click('#btn-result-menu').catch(async () => { await page.click('#menu-result button:has-text("MENU")'); });
  await page.waitForTimeout(300);
  const menuText = await page.textContent('#record');
  if (!new RegExp(`over ${r.games} games`).test(menuText)) fail(`${tag}: main menu record "${menuText}" vs stored ${JSON.stringify(r)}`); else ok(`${tag}: main menu "${menuText}"`);
  await page.click('#btn-quick');
  await page.waitForFunction(() => window.__superbots.match?.phase === 'plan', null, { timeout: 30000 });
  await page.click('#btn-pause'); await page.waitForTimeout(200); await page.click('#btn-quit'); await page.waitForTimeout(300);
  const r3 = await record();
  if (r3.games !== r.games) fail(`${tag}: quitting mid-match changed the record ${JSON.stringify(r)} -> ${JSON.stringify(r3)}`); else ok(`${tag}: quit mid-match leaves record at ${r3.games} games`);
  if (errors.length) fail(`${tag}: page errors: ${errors.slice(0, 3).join(' | ')}`); else ok(`${tag}: no page errors`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} problems` : 'rematch/record clean');
process.exit(fails ? 1 : 0);
