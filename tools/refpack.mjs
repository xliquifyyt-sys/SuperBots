// Renders every bot's vector rig to high-resolution reference art and ControlNet
// control maps, for use as input to art generation or as a brief for an artist.
//
//   python3 -m http.server 8123 --directory .
//   node tools/refpack.mjs
//
// Needs playwright-core plus a Chromium build. Point at them with:
//   PW_MODULE=/path/to/playwright-core  CHROME=/path/to/chromium  node tools/refpack.mjs
const PW = process.env.PW_MODULE || 'playwright-core';
const { chromium } = await import(PW);
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = process.env.PORT || 8123;
const OUT = new URL('../art/reference/', import.meta.url).pathname;

const IDS = ['bulwark', 'magmaw', 'volt', 'warden', 'skyla', 'phantom', 'ricochet', 'gravitas'];
const VARIANTS = [['idle', 'color', 'color'], ['idle', 'silhouette', 'silhouette'], ['fire', 'color', 'pose-fire']];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`http://localhost:${PORT}/tools/reference-render.html`);
await page.waitForFunction(() => window.__ready);

let n = 0;
for (const id of IDS) {
  for (const [anim, mode, tag] of VARIANTS) {
    await page.evaluate(([i, a, m]) => window.renderBot(i, a, m), [id, anim, mode]);
    await page.screenshot({ path: `${OUT}bot_${id}_${tag}.png`, clip: { x: 0, y: 0, width: 1024, height: 1024 }, omitBackground: true });
    n++;
  }
}
await browser.close();
console.log(`rendered ${n} reference images to art/reference/`);
