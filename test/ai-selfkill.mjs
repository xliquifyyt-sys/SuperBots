// AI self-elimination report: 1v1 round robin (hard AI) on every standard map; counts bots that
// die to the kill floor ('fell') on a turn in which they took no damage at all, i.e. they jumped,
// blinked or slammed themselves out. Prints per bot@map counts and repro seeds.
// Usage: node test/ai-selfkill.mjs [seeds=1]   MAX_RATE=0.02 makes it fail above that rate.
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const seeds = Number(process.argv[2] || 1);
const maps = MAP_IDS.filter((id) => MAPS[id].size === 'standard');
const perKey = {}, perBot = {}, examples = [];
let games = 0, selfKills = 0;
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
        if (e.type !== 'eliminated' || e.cause !== 'fell' || hurt.has(e.bot)) continue;
        const id = r.bots[e.bot].botId;
        selfKills++; perKey[`${id}@${map}`] = (perKey[`${id}@${map}`] || 0) + 1; perBot[id] = (perBot[id] || 0) + 1;
        if (examples.length < 10) examples.push(`node test/trace.mjs ${a} ${b} ${map} ${seed}   # ${id} falls on T${t.turn}`);
      }
    }
  }
}
const rate = selfKills / games;
console.log(`${games} hard 1v1 games in ${Date.now() - t0}ms: ${selfKills} undamaged self-eliminations (${(rate * 100).toFixed(1)}% of games)`);
console.log('per bot:', BOT_IDS.map((id) => `${id} ${perBot[id] || 0}`).join(', '));
console.log('worst bot@map:', Object.entries(perKey).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(examples.join('\n'));
const max = process.env.MAX_RATE ? Number(process.env.MAX_RATE) : null;
if (max != null && rate > max) { console.log(`FAIL self-elimination rate ${(rate * 100).toFixed(1)}% > ${(max * 100).toFixed(1)}%`); process.exit(1); }
