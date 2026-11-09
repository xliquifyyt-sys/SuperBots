// QA-35 invariant: numbers the How to Play screen (index.html #menu-help) states must match src/core/defs.js.
// Checks the aim-guide percentages, the Sudden Death respawn HP and the buff duration claim.
// Not a CI gate yet (fails on main until QA-35 lands). Usage: node test/help-text.mjs
import { readFileSync } from 'node:fs';
import { PHYS, POWERUPS, TURN } from '../src/core/defs.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const help = (html.match(/id="menu-help"[\s\S]*?<\/section>|id="menu-help"[\s\S]*?<\/div>\s*<\/div>/) || [html])[0].replace(/<[^>]+>/g, '');
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fail++; };

const pct = (v) => Math.round(v * 100) + '%';
for (const acc of ['low', 'medium', 'high']) {
  const want = pct(PHYS.accuracyGuide[acc]);
  check(new RegExp(`${want}[^.;,]*${acc}`).test(help), `aim guide: help says ${want} for ${acc} accuracy`);
}
const sd = TURN.suddenDeathHp;
const sdHelp = (help.match(/respawn with (\d+) HP/) || [])[1];
if (sd !== undefined && sdHelp) check(Number(sdHelp) === Number(sd), `sudden death: help says ${sdHelp} HP, defs say ${sd}`);

const claim = help.match(/buffs[^.]*last (\d+) turns/);
if (claim) {
  const n = Number(claim[1]);
  const off = Object.values(POWERUPS).filter((p) => p.kind === 'buff' && p.turns !== n).map((p) => `${p.name} ${p.turns}`);
  check(off.length === 0, `buffs: help says every buff lasts ${n} turns${off.length ? `; defs disagree: ${off.join(', ')}` : ''}`);
}
console.log(fail ? `FAIL ${fail} help-text claim(s) disagree with defs.js` : 'PASS help text matches defs.js');
process.exit(fail ? 1 : 0);
