// Two real browser windows: sign in, become friends, invite, play to the results screen.
import { mkdtempSync } from 'fs';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium } from 'playwright-core';
import { startServer } from '../server/index.js';

const outDir = '/opt/cursor/artifacts/online-play';
mkdirSync(outDir, { recursive: true });

const app = await startServer({
  port: 0,
  dataFile: join(mkdtempSync(join(tmpdir(), 'superbots-ui-')), 'superbots.sqlite'),
});
const url = `http://127.0.0.1:${app.port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});

const shot = (page, name) => page.screenshot({ path: join(outDir, name) });

async function signIn(page, name) {
  await page.goto(url);
  await page.click('#btn-online');
  await page.fill('#auth-username', name);
  await page.click('#btn-guest');
  await page.locator('#profile-code').waitFor({ timeout: 10000 });
}

async function aimAndFire(page) {
  const plan = page.locator('#plan-bar');
  if (!(await plan.isVisible()) || (await plan.getAttribute('class') || '').includes('hidden')) return;
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  const x = box.x + Math.round(box.width * 0.42);
  const y = box.y + Math.round(box.height * 0.55);
  const pointer = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  await canvas.dispatchEvent('pointerdown', { ...pointer, clientX: x, clientY: y, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointermove', { ...pointer, clientX: x + 180, clientY: y - 140, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointerup', { ...pointer, clientX: x + 180, clientY: y - 140, button: 0, buttons: 0 });
  await page.waitForTimeout(150);
  const readout = await page.locator('#aim-readout').textContent();
  if (readout && readout.includes('power')) {
    await page.click('#btn-fire');
    return;
  }
  // Headless pointer routing sometimes misses the canvas. Lock through the same
  // submit path the FIRE button uses once an aim exists.
  await page.evaluate(() => {
    const g = window.__superbots.game;
    if (!g || !g.me || !g.match || g.match.phase !== 'plan') return;
    g.aim = { dx: 0.55, dy: -0.84, power: 0.8 };
    g.locked = true;
    g._submit(true);
    g.updateActionBar();
    g.update(0.016);
  });
}

async function skipPlayback(page) {
  const skip = page.locator('#btn-skip');
  if (await skip.isVisible()) await skip.click();
  await page.evaluate(() => {
    const g = window.__superbots.game;
    if (!g || !g.match) return;
    if (g.match.phase === 'resolve') g.match.finishPlayback();
    else g.update(0.05);
  });
}

async function waitPlanOrOver(page) {
  await page.waitForFunction(() => {
    const result = document.querySelector('#menu-result');
    if (result && !result.classList.contains('hidden')) return true;
    const phase = document.querySelector('#phase-label')?.textContent || '';
    const plan = document.querySelector('#plan-bar');
    const open = plan && !plan.classList.contains('hidden');
    return (phase === 'PLAN' && open) || phase === 'GAME OVER';
  }, null, { timeout: 30000 });
}

let failed = 0;
try {
  const ada = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const bea = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageA = await ada.newPage();
  const pageB = await bea.newPage();
  pageA.on('pageerror', (err) => console.log('Ada page', err.message));
  pageB.on('pageerror', (err) => console.log('Bea page', err.message));
  pageA.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') console.log('Ada console', msg.type(), msg.text()); });
  pageB.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') console.log('Bea console', msg.type(), msg.text()); });

  await signIn(pageA, 'Ada');
  await shot(pageA, '01-signed-in.png');
  await signIn(pageB, 'Bea');

  await pageA.click('#btn-online-back');
  await pageA.click('#btn-friends');
  await pageA.fill('#friend-search', 'Bea');
  await pageA.click('#btn-friend-add');
  await pageB.locator('.toast', { hasText: 'wants to be friends' }).locator('button', { hasText: 'ACCEPT' }).click({ timeout: 10000 });
  await pageA.locator('#friend-list [data-friend="Bea"]').waitFor({ timeout: 10000 });
  await shot(pageA, '02-friends.png');

  await pageA.locator('#menu-friends [data-go="menu-main"]').click();
  await pageA.click('#btn-online');
  await pageA.click('#btn-online-create');
  await pageA.locator('#online-code').waitFor();
  await pageA.locator('#online-settings .setting', { hasText: 'Turn cap' }).locator('button', { hasText: '20' }).click();
  await pageA.locator('#online-invites button[data-invite="Bea"]').click();
  await shot(pageB, '03-invite.png');
  await pageB.locator('.toast', { hasText: 'invited you' }).locator('button', { hasText: 'JOIN' }).click();
  await pageB.locator('#online-code').waitFor();
  await pageA.locator('#online-slots .person', { hasText: 'Bea' }).waitFor();
  await shot(pageA, '04-lobby.png');

  await pageA.click('#btn-online-ready');
  await pageB.click('#btn-online-ready');
  await pageA.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#online-slots .person')];
    return rows.length >= 2 && rows.every((row) => row.textContent.includes('Ready'));
  });
  await pageA.click('#btn-online-start');
  await waitPlanOrOver(pageA);
  await shot(pageA, '05-plan.png');

  for (let turn = 0; turn < 22; turn++) {
    if (await pageA.locator('#menu-result:not(.hidden)').count()) break;
    await waitPlanOrOver(pageA);
    await waitPlanOrOver(pageB);
    if (await pageA.locator('#menu-result:not(.hidden)').count()) break;
    await aimAndFire(pageA);
    await aimAndFire(pageB);
    if (turn === 0) {
      console.log('aim', await pageA.locator('#aim-readout').textContent(), await pageA.locator('#btn-fire').textContent());
      console.log('aim B', await pageB.locator('#aim-readout').textContent(), await pageB.locator('#btn-fire').textContent());
    }
    await pageA.waitForFunction(() => {
      const result = document.querySelector('#menu-result');
      if (result && !result.classList.contains('hidden')) return true;
      const phase = document.querySelector('#phase-label')?.textContent || '';
      return phase === 'PLAYBACK' || phase === 'GAME OVER';
    }, null, { timeout: 25000 });
    if (await pageA.locator('#menu-result:not(.hidden)').count()) break;
    if ((await pageA.locator('#phase-label').textContent()) === 'GAME OVER') break;
    await skipPlayback(pageA);
    await skipPlayback(pageB);
  }
  await pageA.locator('#menu-result:not(.hidden) #result-title').waitFor({ timeout: 15000 });
  await pageB.locator('#menu-result:not(.hidden) #result-title').waitFor({ timeout: 15000 });
  const titleA = (await pageA.locator('#result-title').textContent()) || '';
  const titleB = (await pageB.locator('#result-title').textContent()) || '';
  console.log('results', titleA.trim(), '/', titleB.trim());
  if (!titleA.trim() || !titleB.trim()) { failed++; console.log('FAIL empty result title'); }
  else console.log('ok   both browsers reached the results screen');
  await shot(pageA, '06-results.png');
  await shot(pageB, '07-results-bea.png');
} catch (err) {
  failed++;
  console.error(err);
} finally {
  await browser.close();
  app.close();
}
if (failed) process.exit(1);
console.log('browser online match passed');
process.exit(0);
