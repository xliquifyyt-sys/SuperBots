// Ring-out KO credit report (QA-27): hard-AI 1v1s on every standard map. Counts eliminations
// by the kill floor ('fell') on a turn in which the victim took damage (i.e. it was knocked out,
// not a self-jump) and how often the winner of a decisive 1v1 finishes with 0 KOs in its stats.
// Usage: node test/ringout-credit.mjs [seeds=1]   STRICT=1 makes it fail if any knocked-out
// elimination leaves the opponent with no KO credit.
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const seeds = Number(process.argv[2] || 1);
const maps = MAP_IDS.filter((id) => MAPS[id].size === 'standard');
let games = 0, decisive = 0, zeroKoWinners = 0, knockedFalls = 0, uncredited = 0;
const examples = [];
const t0 = Date.now();
for (let s = 0; s < seeds; s++) for (const a of BOT_IDS) for (const b of BOT_IDS) {
  if (a === b) continue;
  for (const map of maps) {
    const seed = 5000 + s * 1000 + BOT_IDS.indexOf(a) * 8 + BOT_IDS.indexOf(b) + maps.indexOf(map) * 100;
    const r = Match.simulateHeadless([{ name: 'A', botId: a, team: 0 }, { name: 'B', botId: b, team: 1 }], { mode: 'ffa', map, aiDifficulty: 'hard', powerups: 'normal' }, seed);
    games++;
    for (const t of r.log) {
      const hurt = new Set(t.events.filter((e) => e.type === 'damage' && e.amount > 0).map((e) => e.bot));
      for (const e of t.events) {
        if (e.type !== 'eliminated' || e.cause !== 'fell' || !hurt.has(e.bot)) continue;
        knockedFalls++;
        const other = r.bots[1 - e.bot];
        if (other && other.stats.kills === 0) {
          uncredited++;
          if (examples.length < 8) examples.push(`node test/trace.mjs ${a} ${b} ${map} ${seed}   # ${r.bots[e.bot].botId} knocked into the kill floor T${t.turn}, ${other.botId} ends with 0 KOs`);
        }
      }
    }
    const alive = r.bots.filter((x) => x.alive);
    if (alive.length === 1) { decisive++; if (alive[0].stats.kills === 0) zeroKoWinners++; }
  }
}
console.log(`${games} hard 1v1 games in ${Date.now() - t0}ms`);
console.log(`knocked-into-kill-floor eliminations: ${knockedFalls}, of which the opponent got no KO credit: ${uncredited}`);
console.log(`decisive games (one survivor): ${decisive}, winner shows 0 KOs: ${zeroKoWinners} (${decisive ? (100 * zeroKoWinners / decisive).toFixed(1) : 0}%)`);
console.log(examples.join('\n'));
if (process.env.STRICT && uncredited > 0) { console.log(`FAIL ${uncredited} ring-outs credited to nobody`); process.exit(1); }
