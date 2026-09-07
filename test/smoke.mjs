// Headless smoke test: drives Super Bots through a full match and fails on any runtime error.
// Usage: python3 -m http.server 8123 &  then  node test/smoke.mjs
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:8123';
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}/index.html`);
await page.waitForSelector('[data-go="menu-select"]');
await page.click('[data-go="menu-select"]');
await page.click('.card[data-cls="titan"]');
await page.click('[data-enemy="phantom"]');
await page.click('[data-diff="hard"]');
await page.click('#btn-start');

const snapshot = () => page.evaluate(() => {
  const { game } = window.__superbots;
  return { state: game.state, score: game.score, round: game.round, running: game.running };
});
const waitFor = async (pred, label) => {
  for (let i = 0; i < 240; i++) {
    const s = await snapshot();
    if (pred(s)) { console.log(label, JSON.stringify(s)); return s; }
    await page.waitForTimeout(250);
  }
  throw new Error('timeout waiting for ' + label);
};

await waitFor((s) => s.state === 'play', 'round 1 started');
// Simulate a player that runs at the enemy while firing (pointer lock is unavailable headless).
await page.evaluate(() => { const { input } = window.__superbots; input.locked = true; input.fire = true; });
for (let i = 0; i < 10; i++) {
  await page.evaluate((i) => {
    const { game, input } = window.__superbots;
    const p = game.player, e = game.enemy;
    if (p && e) p.yaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    input.keys.clear(); input.keys.add('KeyW'); input.keys.add(i % 2 ? 'KeyA' : 'KeyD');
    if (i === 3) input.pressed.add('Space');
    if (i === 5) input.pressed.add('KeyE');
  }, i);
  await page.waitForTimeout(400);
}
// Force round outcomes to exercise the full match flow.
await page.evaluate(() => window.__superbots.game.enemy.takeDamage(9999, null));
await waitFor((s) => s.state === 'roundEnd', 'round 1 ended');
await waitFor((s) => s.state === 'play' && s.round === 2, 'round 2 started');
await page.evaluate(() => window.__superbots.game.enemy.takeDamage(9999, null));
await waitFor((s) => s.state === 'idle' && !s.running, 'match ended');
await page.waitForSelector('#menu-result:not(.hidden)');
console.log('result:', await page.textContent('#result-sub'));

// Pause / quit flow
await page.click('#btn-rematch');
await waitFor((s) => s.running, 'rematch started');
await page.evaluate(() => window.__superbots.game.pause());
await page.waitForSelector('#menu-pause:not(.hidden)');
await page.click('#btn-quit');
await page.waitForSelector('#menu-main:not(.hidden)');

await page.screenshot({ path: 'test/smoke.png' }).catch(() => {});
await browser.close();
if (errors.length) { console.error('Runtime errors:', errors); process.exit(1); }
console.log('OK: no runtime errors');
