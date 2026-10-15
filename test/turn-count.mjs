// QA-8 invariant: the number of turns a match reports (Match#turn at 'over', shown as "N turns" on
// the results screen and returned as summary.turns) must equal the turns actually played. For a
// match won by elimination that is the turn the last bot died on.
// Usage: node test/turn-count.mjs [matches=20]
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const N = Number(process.argv[2] || 20);
let bad = 0, checked = 0;
for (let i = 0; i < N; i++) {
  const n = 2 + (i % 3);
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 3 + k * 5) % BOT_IDS.length], team: k, isAI: true }));
  const settings = { mode: 'ffa', map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: 'normal', powerups: 'normal' };
  const r = Match.simulateHeadless(players, settings, 7000 + i);
  if (r.winner.type === 'draw' || r.winner.byCap) continue;
  const lastDeath = Math.max(...r.bots.filter((b) => !b.alive).map((b) => b.diedTurn));
  if (!Number.isFinite(lastDeath)) continue;
  checked++;
  if (r.turns !== lastDeath) { bad++; if (bad <= 5) console.log(`MISMATCH seed ${7000 + i} ${settings.map} ${n}p: reports ${r.turns} turns, last death on turn ${lastDeath}`); }
}
console.log(`${checked} elimination wins checked, ${bad} report the wrong turn count`);
process.exit(bad ? 1 : 0);
