// QA exploratory: quit to menu mid-match (during plan and during playback), then start a new match
// (Quick 1v1, then Rematch from results). Checks the old match is gone (no stale world events, turn
// label back to TURN 1, exactly one live match object, no page errors).
// Usage: python3 -m http.server 8123 & CHROMIUM_PATH=... node test/quit-requeue.mjs [outDir]
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
  const waitFor = async (want, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await phase() === want) return true; await page.waitForTimeout(100); } return false; };
  const fire = async () => { await page.mouse.move(vp[0] / 2, vp[1] * 0.45); await page.mouse.down(); await page.mouse.move(vp[0] / 2 - 90, vp[1] * 0.45 + 70, { steps: 5 }); await page.mouse.up(); await page.click('#btn-fire'); };
  for (const when of ['plan', 'playback']) {
    await page.click('#btn-quick');
    if (!(await waitFor('plan'))) { fail(`${tag} ${when}: first match never reached plan`); continue; }
    const old = await page.evaluate(() => { window.__oldMatch = window.__superbots.match; return window.__superbots.match.world.turn; });
    if (when === 'playback') { await fire(); await page.waitForTimeout(700); }
    await page.click('#btn-pause'); await page.waitForTimeout(200); await page.click('#btn-quit'); await page.waitForTimeout(400);
    const menuVisible = await page.isVisible('#btn-quick');
    if (!menuVisible) { fail(`${tag} ${when}: QUIT TO MENU did not show the main menu`); continue; }
    // let the old match run if it is still ticking
    const t0 = await page.evaluate(() => window.__oldMatch.world.turn);
    await page.waitForTimeout(3000);
    const t1 = await page.evaluate(() => window.__oldMatch.world.turn);
    if (t1 !== t0) fail(`${tag} ${when}: quit match keeps simulating behind the menu (turn ${t0} -> ${t1})`); else ok(`${tag} ${when}: quit match frozen at turn ${t1}`);
    await page.click('#btn-quick');
    if (!(await waitFor('plan'))) { fail(`${tag} ${when}: second match never reached plan`); continue; }
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ same: window.__superbots.match === window.__oldMatch, turn: window.__superbots.match.world.turn, label: document.getElementById('turn-label')?.textContent, roster: document.querySelectorAll('#roster > *').length, bots: window.__superbots.match.world.bots.length }));
    if (st.same) fail(`${tag} ${when}: Quick 1v1 after quit reuses the old match object`);
    if (!/TURN 1\b/.test(st.label || '')) fail(`${tag} ${when}: new match label "${st.label}" (want TURN 1)`);
    if (st.roster !== st.bots) fail(`${tag} ${when}: roster has ${st.roster} rows for ${st.bots} bots`);
    else ok(`${tag} ${when}: new match label "${st.label}", roster ${st.roster}/${st.bots}`);
    if (out) await page.screenshot({ path: `${out}/quit-${when}-${tag}.png` });
    await page.click('#btn-pause'); await page.waitForTimeout(200); await page.click('#btn-quit'); await page.waitForTimeout(300);
  }
  if (errors.length) fail(`${tag}: page errors: ${errors.slice(0, 3).join(' | ')}`); else ok(`${tag}: no page errors`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} problems` : 'quit/requeue clean');
process.exit(fails ? 1 : 0);
